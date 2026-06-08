//go:build windows

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// PostIt represents a sticky note entry.
type PostIt struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Path   string `json:"path"`
	Hotkey string `json:"hotkey"`
}

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
	log.Println("[UPDATE] UpdatePostIt id=", updated.ID, "hotkey=", updated.Hotkey)
	a.mu.Lock()
	defer a.mu.Unlock()

	for i, p := range a.cfg.PostIts {
		if p.ID == updated.ID {
			oldHotkey := p.Hotkey
			updated.Path = p.Path
			a.cfg.PostIts[i] = updated
			if err := a.saveConfig(); err != nil {
				return err
			}
			a.mu.Unlock()
			if oldHotkey != updated.Hotkey {
				log.Println("[UPDATE]   hotkey changed, calling rebuildHotkeys old=", oldHotkey, "new=", updated.Hotkey)
				a.rebuildHotkeys()
			} else {
				log.Println("[UPDATE]   hotkey unchanged, skipping rebuildHotkeys")
			}
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

// pathForID returns the file path for the given postit id, or "" if missing.
func (a *App) pathForID(id string) string {
	for _, p := range a.cfg.PostIts {
		if p.ID == id {
			return p.Path
		}
	}
	return ""
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
