//go:build windows

package main

import (
	"github.com/fsnotify/fsnotify"
)

// startWatcher starts the fsnotify watcher for all known postit files.
//
// Today the watcher silently drains Write events. PostitViewer still uses
// the "reload-content" event (emitted from TogglePostitWindow) and does not
// subscribe to "file-changed-externally". Re-enable the broadcast here when
// an external-edit feature ships.
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
			case _, ok := <-watcher.Events:
				if !ok {
					return
				}
			case _, ok := <-watcher.Errors:
				if !ok {
					return
				}
			}
		}
	}()
}
