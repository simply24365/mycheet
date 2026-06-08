//go:build windows

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type appConfig struct {
	BaseDir string   `json:"baseDir"`
	Theme   string   `json:"theme,omitempty"`
	PostIts []PostIt `json:"postits"`
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
