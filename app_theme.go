//go:build windows

package main

import (
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// GetTheme returns the current theme preset ID.
func (a *App) GetTheme() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if strings.TrimSpace(a.cfg.Theme) == "" {
		return defaultThemeID, nil
	}
	return a.cfg.Theme, nil
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
