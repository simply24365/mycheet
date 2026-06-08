//go:build windows

// Package main is the Wails entrypoint for the mycheet sticky-notes app.
//
// File layout (all in package main):
//   - app.go           — App struct, NewApp, Init (lifecycle)
//   - app_config.go    — appConfig persistence + paths
//   - app_postit.go    — PostIt CRUD + file content
//   - app_window.go    — Per-postit + palette WebviewWindow management
//   - app_hotkey.go    — Global hotkey registration + parsing
//   - app_watcher.go   — fsnotify watcher for note files
//   - app_files.go     — File/directory pickers + open-in-explorer/editor
//   - app_palette.go   — Recent-postit ordering
//   - app_theme.go     — Theme preset get/set
//   - app_basedir.go   — Base directory get/set
//   - app_autostart.go — OS autostart toggle
//   - main.go          — application bootstrap (windows, tray, single instance)
package main

import (
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	appName        = "mycheet"
	legacyAppName  = "gosheet"
	defaultThemeID = "obsidian"
)

// App is the main Wails service.
type App struct {
	mu               sync.Mutex
	settingsWin      *application.WebviewWindow
	paletteWin       *application.WebviewWindow
	postitWins       map[string]*application.WebviewWindow
	cfg              appConfig
	watcher          *fsnotify.Watcher
	hotkeys          map[string]*hotkeyEntry
	paletteHotkey    *hotkeyEntry
	recentPostitIDs  []string
	hotkeysSuspended bool
}

// NewApp creates a new App instance.
func NewApp() *App {
	return &App{
		postitWins: make(map[string]*application.WebviewWindow),
		hotkeys:    make(map[string]*hotkeyEntry),
	}
}

// Init loads config, migrates paths, starts the watcher, and registers hotkeys.
// Called by main.go after window references are wired up.
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
	a.startWatcher()
}
