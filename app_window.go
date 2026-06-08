//go:build windows

package main

import (
	"fmt"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// TogglePostitWindow shows or hides the window for the given sticky note.
func (a *App) TogglePostitWindow(id string) error {
	log.Println("[TOGGLE] TogglePostitWindow id=", id)

	a.mu.Lock()
	win, exists := a.postitWins[id]
	a.mu.Unlock()

	if !exists {
		log.Println("[TOGGLE]   -> window missing, calling openPostitWindow id=", id)
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
		log.Println("[TOGGLE]   -> hiding window id=", id)
		win.Hide()
	} else {
		log.Println("[TOGGLE]   -> showing window id=", id)
		a.markPostitRecent(id)
		win.Show()
		win.Focus()
		win.EmitEvent("reload-content")
	}
	return nil
}

func (a *App) openPostitWindow(id string) error {
	log.Println("[OPEN]   openPostitWindow id=", id)

	a.mu.Lock()
	if _, exists := a.postitWins[id]; exists {
		a.mu.Unlock()
		log.Println("[OPEN]   -> already exists, skip id=", id)
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

	log.Println("[OPEN]   -> creating WebviewWindow id=", id, "title=", title)

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

// HideCommandPalette hides the command palette window.
func (a *App) HideCommandPalette() error {
	return a.hideCommandPalette()
}

// TogglePalettePostIt toggles the selected sticky note and hides the command palette.
func (a *App) TogglePalettePostIt(id string) error {
	_ = a.hideCommandPalette()
	return a.TogglePostitWindow(id)
}
