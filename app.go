//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"unicode"

	"github.com/fsnotify/fsnotify"
	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"golang.design/x/hotkey"
)

const (
	appName        = "mycheet"
	legacyAppName  = "gosheet"
	defaultThemeID = "obsidian"
)

// PostIt represents a sticky note entry.
type PostIt struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Path   string `json:"path"`
	Hotkey string `json:"hotkey"`
}

type appConfig struct {
	BaseDir string   `json:"baseDir"`
	Theme   string   `json:"theme,omitempty"`
	PostIts []PostIt `json:"postits"`
}

type hotkeyEntry struct {
	hk   *hotkey.Hotkey
	stop chan struct{}
}

// App is the main Wails service.
type App struct {
	mu              sync.Mutex
	settingsWin     *application.WebviewWindow
	paletteWin      *application.WebviewWindow
	postitWins      map[string]*application.WebviewWindow
	cfg             appConfig
	watcher         *fsnotify.Watcher
	hotkeys         map[string]*hotkeyEntry
	paletteHotkey   *hotkeyEntry
	recentPostitIDs []string
}

// NewApp creates a new App instance.
func NewApp() *App {
	return &App{
		postitWins: make(map[string]*application.WebviewWindow),
		hotkeys:    make(map[string]*hotkeyEntry),
	}
}

// settingsPath returns the path to the settings JSON file.
func settingsPath() string {
	profile := os.Getenv("USERPROFILE")
	return filepath.Join(profile, "Documents", appName, "settings.json")
}

func legacySettingsPath() string {
	profile := os.Getenv("USERPROFILE")
	return filepath.Join(profile, "Documents", legacyAppName, "settings.json")
}

func defaultBaseDir() string {
	return filepath.Join(os.Getenv("USERPROFILE"), "Documents", appName)
}

// loadConfig reads the settings file. If it does not exist, returns default config.
func (a *App) loadConfig() error {
	p := settingsPath()
	data, err := os.ReadFile(p)
	if os.IsNotExist(err) {
		data, err = os.ReadFile(legacySettingsPath())
		if os.IsNotExist(err) {
			a.cfg = appConfig{BaseDir: defaultBaseDir(), Theme: defaultThemeID}
			return nil
		}
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, &a.cfg); err != nil {
		return err
	}
	if strings.TrimSpace(a.cfg.BaseDir) == "" {
		a.cfg.BaseDir = defaultBaseDir()
	}
	if strings.TrimSpace(a.cfg.Theme) == "" {
		a.cfg.Theme = defaultThemeID
	}
	return nil
}

// saveConfig writes the current config to the settings file.
func (a *App) saveConfig() error {
	p := settingsPath()
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(a.cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0644)
}

// migrateOneDrivePath converts OneDrive document paths to local Documents paths.
func migrateOneDrivePath(p string) string {
	profile := os.Getenv("USERPROFILE")
	oneDrive := filepath.Join(profile, "OneDrive", "Documents")
	local := filepath.Join(profile, "Documents")
	if strings.HasPrefix(p, oneDrive) {
		return local + p[len(oneDrive):]
	}
	return p
}

// Init loads config, starts the file watcher, and registers hotkeys.
// Called after SetSettingsWin, before app.Run().
func (a *App) Init() {
	if err := a.loadConfig(); err != nil {
		a.cfg = appConfig{BaseDir: defaultBaseDir(), Theme: defaultThemeID}
	}
	// Migrate OneDrive paths
	a.cfg.BaseDir = migrateOneDrivePath(a.cfg.BaseDir)
	for i := range a.cfg.PostIts {
		a.cfg.PostIts[i].Path = migrateOneDrivePath(a.cfg.PostIts[i].Path)
	}

	a.rebuildHotkeys()
	a.registerCommandPaletteHotkey()
}

// --- Wails service methods ---

// GetPostIts returns all sticky notes.
func (a *App) GetPostIts() ([]PostIt, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	result := make([]PostIt, len(a.cfg.PostIts))
	copy(result, a.cfg.PostIts)
	return result, nil
}

// GetPostItByID returns a single sticky note by ID.
func (a *App) GetPostItByID(id string) (*PostIt, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, p := range a.cfg.PostIts {
		if p.ID == id {
			cp := p
			return &cp, nil
		}
	}
	return nil, nil
}

// AddPostIt creates a new sticky note with the given title.
func (a *App) AddPostIt(title string) (PostIt, error) {
	return a.addPostIt(title, "")
}

// AddPostItWithPath creates a new sticky note linked to an existing file.
func (a *App) AddPostItWithPath(title, path string) (PostIt, error) {
	return a.addPostIt(title, path)
}

func (a *App) addPostIt(title, path string) (PostIt, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	id := uuid.NewString()
	if path == "" {
		if err := os.MkdirAll(a.cfg.BaseDir, 0755); err != nil {
			return PostIt{}, err
		}
		safe := sanitizeFilename(title)
		if safe == "" {
			safe = id
		}
		path = filepath.Join(a.cfg.BaseDir, safe+".md")
		// Avoid collision
		base := path
		for i := 2; ; i++ {
			if _, err := os.Stat(path); os.IsNotExist(err) {
				break
			}
			path = strings.TrimSuffix(base, ".md") + fmt.Sprintf("_%d.md", i)
		}
		if err := os.WriteFile(path, []byte(""), 0644); err != nil {
			return PostIt{}, err
		}
	}

	p := PostIt{ID: id, Title: title, Path: path}
	a.cfg.PostIts = append(a.cfg.PostIts, p)
	if err := a.saveConfig(); err != nil {
		return PostIt{}, err
	}

	application.Get().Event.Emit("postits-updated")
	return p, nil
}

// UpdatePostIt saves changes to an existing sticky note (title, hotkey).
func (a *App) UpdatePostIt(updated PostIt) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, p := range a.cfg.PostIts {
		if p.ID == updated.ID {
			// Keep path from stored record
			updated.Path = p.Path
			a.cfg.PostIts[i] = updated
			if err := a.saveConfig(); err != nil {
				return err
			}
			a.mu.Unlock()
			a.rebuildHotkeys()
			a.mu.Lock()
			application.Get().Event.Emit("postits-updated")
			return nil
		}
	}
	return fmt.Errorf("postit %s not found", updated.ID)
}

// DeletePostIt removes a sticky note from the list (does not delete file).
func (a *App) DeletePostIt(id string) error {
	return a.deletePostIt(id, false)
}

// DeletePostItAndFile removes a sticky note and deletes its file.
func (a *App) DeletePostItAndFile(id string) error {
	return a.deletePostIt(id, true)
}

func (a *App) deletePostIt(id string, deleteFile bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, p := range a.cfg.PostIts {
		if p.ID == id {
			a.cfg.PostIts = append(a.cfg.PostIts[:i], a.cfg.PostIts[i+1:]...)
			a.removeRecentPostitIDLocked(id)
			if err := a.saveConfig(); err != nil {
				return err
			}
			if deleteFile && p.Path != "" {
				_ = os.Remove(p.Path)
			}
			// Close the window if open
			a.mu.Unlock()
			a.closePostitWindow(id)
			a.unregisterHotkey(id)
			a.mu.Lock()
			application.Get().Event.Emit("postits-updated")
			return nil
		}
	}
	return fmt.Errorf("postit %s not found", id)
}

// GetContent reads and returns the file contents for a sticky note.
func (a *App) GetContent(id string) (string, error) {
	a.mu.Lock()
	path := a.pathForID(id)
	a.mu.Unlock()

	if path == "" {
		return "", fmt.Errorf("postit %s not found", id)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GetBaseDir returns the current base directory.
func (a *App) GetBaseDir() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.cfg.BaseDir, nil
}

// GetTheme returns the current theme preset ID.
func (a *App) GetTheme() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if strings.TrimSpace(a.cfg.Theme) == "" {
		return defaultThemeID, nil
	}
	return a.cfg.Theme, nil
}

// GetPalettePostIts returns sticky notes ordered by recent open activity.
func (a *App) GetPalettePostIts() ([]PostIt, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.sortedPalettePostItsLocked(), nil
}

// SetBaseDir changes the base directory.
func (a *App) SetBaseDir(dir string) error {
	a.mu.Lock()
	a.cfg.BaseDir = dir
	err := a.saveConfig()
	a.mu.Unlock()
	return err
}

// SetTheme changes the active theme preset and broadcasts the update.
func (a *App) SetTheme(theme string) error {
	theme = strings.TrimSpace(theme)
	if theme == "" {
		theme = defaultThemeID
	}

	a.mu.Lock()
	a.cfg.Theme = theme
	err := a.saveConfig()
	a.mu.Unlock()
	if err != nil {
		return err
	}
	application.Get().Event.Emit("theme-changed", theme)
	return nil
}

// HideCommandPalette hides the command palette window.
func (a *App) HideCommandPalette() error {
	return a.hideCommandPalette()
}

// TogglePalettePostIt toggles the selected sticky note and hides the command palette.
func (a *App) TogglePalettePostIt(id string) error {
	_ = a.hideCommandPalette()
	return a.TogglePostitWindow(id)
}

// ListBaseDirFiles returns all .md files in the base directory.
func (a *App) ListBaseDirFiles() ([]string, error) {
	a.mu.Lock()
	dir := a.cfg.BaseDir
	a.mu.Unlock()

	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".md") {
			files = append(files, filepath.Join(dir, e.Name()))
		}
	}
	if files == nil {
		files = []string{}
	}
	return files, nil
}

// BrowseFile opens a file picker dialog and returns the selected path.
func (a *App) BrowseFile() (string, error) {
	a.mu.Lock()
	baseDir := a.cfg.BaseDir
	window := a.settingsWin
	a.mu.Unlock()

	dialog := application.Get().Dialog.OpenFile().
		SetTitle("파일 선택").
		SetDirectory(baseDir).
		AddFilter("Markdown files", "*.md;*.txt").
		AddFilter("All files", "*.*")
	if window != nil {
		dialog.AttachToWindow(window)
	}
	return dialog.PromptForSingleSelection()
}

// BrowseBaseDir opens a folder picker dialog and returns the selected path.
func (a *App) BrowseBaseDir() (string, error) {
	a.mu.Lock()
	baseDir := a.cfg.BaseDir
	window := a.settingsWin
	a.mu.Unlock()

	dialog := application.Get().Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle("기본 폴더 선택").
		SetMessage("기본 폴더를 선택하세요").
		SetDirectory(baseDir)
	if window != nil {
		dialog.AttachToWindow(window)
	}
	return dialog.PromptForSingleSelection()
}

// OpenBaseDir opens the base directory in Windows Explorer.
func (a *App) OpenBaseDir() error {
	a.mu.Lock()
	dir := a.cfg.BaseDir
	a.mu.Unlock()
	return exec.Command("explorer", dir).Start()
}

// OpenPostItInEditor opens the sticky note file in the system's default editor.
func (a *App) OpenPostItInEditor(id string) error {
	a.mu.Lock()
	path := a.pathForID(id)
	a.mu.Unlock()
	if path == "" {
		return fmt.Errorf("postit %s not found", id)
	}
	if _, err := os.Stat(path); err != nil {
		return err
	}
	return exec.Command("cmd", "/c", "start", "", path).Start()
}

func (a *App) showCommandPalette() error {
	a.mu.Lock()
	win := a.paletteWin
	a.mu.Unlock()
	if win == nil {
		return fmt.Errorf("command palette window not configured")
	}
	win.Center()
	win.Show()
	win.Focus()
	application.Get().Event.Emit("command-palette-opened")
	return nil
}

func (a *App) hideCommandPalette() error {
	a.mu.Lock()
	win := a.paletteWin
	a.mu.Unlock()
	if win == nil {
		return fmt.Errorf("command palette window not configured")
	}
	win.Hide()
	return nil
}

func (a *App) toggleCommandPalette() error {
	a.mu.Lock()
	win := a.paletteWin
	a.mu.Unlock()
	if win == nil {
		return fmt.Errorf("command palette window not configured")
	}
	if win.IsVisible() {
		return a.hideCommandPalette()
	}
	return a.showCommandPalette()
}

// TogglePostitWindow shows or hides the window for the given sticky note.
func (a *App) TogglePostitWindow(id string) error {
	a.mu.Lock()
	win, exists := a.postitWins[id]
	a.mu.Unlock()

	if !exists {
		if err := a.openPostitWindow(id); err != nil {
			return err
		}
		a.mu.Lock()
		win = a.postitWins[id]
		a.mu.Unlock()
		if win == nil {
			return fmt.Errorf("postit window %s not found after creation", id)
		}
	}
	if win.IsVisible() {
		win.Hide()
	} else {
		a.markPostitRecent(id)
		win.Show()
		win.Focus()
		win.EmitEvent("reload-content")
	}
	return nil
}

// GetAutostartEnabled returns whether autostart is enabled.
func (a *App) GetAutostartEnabled() (bool, error) {
	return application.Get().Autostart.IsEnabled()
}

// SetAutostartEnabled enables or disables autostart.
func (a *App) SetAutostartEnabled(enable bool) error {
	app := application.Get()
	if enable {
		return app.Autostart.Enable()
	}
	return app.Autostart.Disable()
}

// InitWindowsAndTray is called by the frontend after it is ready.
// Creates postit windows and returns.
func (a *App) InitWindowsAndTray() error {
	a.mu.Lock()
	postits := make([]PostIt, len(a.cfg.PostIts))
	copy(postits, a.cfg.PostIts)
	a.mu.Unlock()

	for _, p := range postits {
		if err := a.openPostitWindow(p.ID); err != nil {
			return err
		}
	}
	return nil
}

// --- Internal helpers ---

func (a *App) pathForID(id string) string {
	for _, p := range a.cfg.PostIts {
		if p.ID == id {
			return p.Path
		}
	}
	return ""
}

func (a *App) openPostitWindow(id string) error {
	a.mu.Lock()
	if _, exists := a.postitWins[id]; exists {
		a.mu.Unlock()
		return nil
	}
	var title string
	for _, p := range a.cfg.PostIts {
		if p.ID == id {
			title = p.Title
			break
		}
	}
	a.mu.Unlock()

	app := application.Get()
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            title,
		Width:            340,
		Height:           460,
		Frameless:        true,
		AlwaysOnTop:      true,
		Hidden:           true,
		BackgroundColour: application.NewRGB(10, 10, 10),
		URL:              "/?id=" + id,
		Windows: application.WindowsWindow{
			Theme: application.SystemDefault,
		},
	})

	win.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		event.Cancel()
		win.Hide()
	})

	a.mu.Lock()
	a.postitWins[id] = win
	a.mu.Unlock()
	return nil
}

func (a *App) closePostitWindow(id string) {
	a.mu.Lock()
	win, exists := a.postitWins[id]
	if exists {
		delete(a.postitWins, id)
	}
	a.mu.Unlock()
	if exists {
		win.Hide()
	}
}

func (a *App) markPostitRecent(id string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.removeRecentPostitIDLocked(id)
	a.recentPostitIDs = append([]string{id}, a.recentPostitIDs...)
}

func (a *App) removeRecentPostitIDLocked(id string) {
	filtered := a.recentPostitIDs[:0]
	for _, existingID := range a.recentPostitIDs {
		if existingID != id {
			filtered = append(filtered, existingID)
		}
	}
	a.recentPostitIDs = filtered
}

func (a *App) sortedPalettePostItsLocked() []PostIt {
	byID := make(map[string]PostIt, len(a.cfg.PostIts))
	for _, postit := range a.cfg.PostIts {
		byID[postit.ID] = postit
	}

	result := make([]PostIt, 0, len(a.cfg.PostIts))
	seen := make(map[string]struct{}, len(a.cfg.PostIts))
	for _, id := range a.recentPostitIDs {
		postit, ok := byID[id]
		if !ok {
			continue
		}
		result = append(result, postit)
		seen[id] = struct{}{}
	}
	for _, postit := range a.cfg.PostIts {
		if _, ok := seen[postit.ID]; ok {
			continue
		}
		result = append(result, postit)
	}
	return result
}

// startWatcher starts the fsnotify watcher for all known postit files.
func (a *App) startWatcher() {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return
	}
	a.watcher = watcher

	for _, p := range a.cfg.PostIts {
		if p.Path != "" {
			_ = watcher.Add(p.Path)
		}
	}

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Has(fsnotify.Write) {
					// Find which postit matches this file
					a.mu.Lock()
					var matchID string
					for _, p := range a.cfg.PostIts {
						if filepath.Clean(p.Path) == filepath.Clean(event.Name) {
							matchID = p.ID
							break
						}
					}
					a.mu.Unlock()
					if matchID != "" {
						application.Get().Event.Emit("file-changed-externally", matchID)
					}
				}
			case _, ok := <-watcher.Errors:
				if !ok {
					return
				}
			}
		}
	}()
}

func (a *App) watchFile(path string) {
	if a.watcher != nil && path != "" {
		_ = a.watcher.Add(path)
	}
}

// rebuildHotkeys unregisters all existing hotkeys and registers new ones.
func (a *App) rebuildHotkeys() {
	a.mu.Lock()
	// Unregister all
	for id, entry := range a.hotkeys {
		_ = entry.hk.Unregister()
		close(entry.stop)
		delete(a.hotkeys, id)
	}
	postits := make([]PostIt, len(a.cfg.PostIts))
	copy(postits, a.cfg.PostIts)
	a.mu.Unlock()

	for _, p := range postits {
		if p.Hotkey == "" {
			continue
		}
		id := p.ID
		mods, key, err := parseHotkey(p.Hotkey)
		if err != nil {
			continue
		}
		hk := hotkey.New(mods, key)
		if err := hk.Register(); err != nil {
			continue
		}
		stop := make(chan struct{})
		a.mu.Lock()
		a.hotkeys[id] = &hotkeyEntry{hk: hk, stop: stop}
		a.mu.Unlock()

		go func(hk *hotkey.Hotkey, id string, stop chan struct{}) {
			for {
				select {
				case <-stop:
					return
				case <-hk.Keydown():
					_ = a.TogglePostitWindow(id)
				}
			}
		}(hk, id, stop)
	}
}

func (a *App) registerCommandPaletteHotkey() {
	a.mu.Lock()
	existing := a.paletteHotkey
	a.paletteHotkey = nil
	a.mu.Unlock()
	if existing != nil {
		_ = existing.hk.Unregister()
		close(existing.stop)
	}

	hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift}, hotkey.Key(0x20))
	if err := hk.Register(); err != nil {
		return
	}

	stop := make(chan struct{})
	a.mu.Lock()
	a.paletteHotkey = &hotkeyEntry{hk: hk, stop: stop}
	a.mu.Unlock()

	go func(hk *hotkey.Hotkey, stop chan struct{}) {
		for {
			select {
			case <-stop:
				return
			case <-hk.Keydown():
				_ = a.toggleCommandPalette()
			}
		}
	}(hk, stop)
}

func (a *App) unregisterHotkey(id string) {
	a.mu.Lock()
	entry, exists := a.hotkeys[id]
	if exists {
		delete(a.hotkeys, id)
	}
	a.mu.Unlock()
	if exists {
		_ = entry.hk.Unregister()
		close(entry.stop)
	}
}

// parseHotkey parses a hotkey string like "Ctrl+Shift+F1" into modifiers and key.
func parseHotkey(s string) ([]hotkey.Modifier, hotkey.Key, error) {
	parts := strings.Split(s, "+")
	if len(parts) < 2 {
		return nil, 0, fmt.Errorf("invalid hotkey: %s", s)
	}

	var mods []hotkey.Modifier
	for _, part := range parts[:len(parts)-1] {
		switch strings.ToLower(strings.TrimSpace(part)) {
		case "ctrl":
			mods = append(mods, hotkey.ModCtrl)
		case "shift":
			mods = append(mods, hotkey.ModShift)
		case "alt":
			mods = append(mods, hotkey.ModAlt)
		case "win":
			mods = append(mods, hotkey.ModWin)
		default:
			return nil, 0, fmt.Errorf("unknown modifier: %s", part)
		}
	}

	keyStr := strings.TrimSpace(parts[len(parts)-1])
	key, err := parseKey(keyStr)
	if err != nil {
		return nil, 0, err
	}
	return mods, key, nil
}

func parseKey(s string) (hotkey.Key, error) {
	s = strings.ToUpper(strings.TrimSpace(s))
	// Function keys F1–F12
	fkeys := map[string]hotkey.Key{
		"F1": hotkey.KeyF1, "F2": hotkey.KeyF2, "F3": hotkey.KeyF3,
		"F4": hotkey.KeyF4, "F5": hotkey.KeyF5, "F6": hotkey.KeyF6,
		"F7": hotkey.KeyF7, "F8": hotkey.KeyF8, "F9": hotkey.KeyF9,
		"F10": hotkey.KeyF10, "F11": hotkey.KeyF11, "F12": hotkey.KeyF12,
	}
	if k, ok := fkeys[s]; ok {
		return k, nil
	}
	// Single letter A–Z
	if len(s) == 1 && s[0] >= 'A' && s[0] <= 'Z' {
		return hotkey.Key(s[0]), nil
	}
	// Single digit 0–9
	if len(s) == 1 && s[0] >= '0' && s[0] <= '9' {
		return hotkey.Key(s[0]), nil
	}
	return 0, fmt.Errorf("unknown key: %s", s)
}

// sanitizeFilename replaces characters invalid in filenames with underscores.
func sanitizeFilename(s string) string {
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' || r == ' ' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	return strings.TrimSpace(b.String())
}
