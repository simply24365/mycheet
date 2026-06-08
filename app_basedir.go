//go:build windows

package main

// GetBaseDir returns the current base directory.
func (a *App) GetBaseDir() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.cfg.BaseDir, nil
}

// SetBaseDir changes the base directory.
func (a *App) SetBaseDir(dir string) error {
	a.mu.Lock()
	a.cfg.BaseDir = dir
	err := a.saveConfig()
	a.mu.Unlock()
	return err
}
