//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

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
