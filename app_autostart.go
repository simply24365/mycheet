//go:build windows

package main

import "github.com/wailsapp/wails/v3/pkg/application"

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
