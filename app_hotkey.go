//go:build windows

package main

import (
	"fmt"
	"log"
	"strings"

	"golang.design/x/hotkey"
)

type hotkeyEntry struct {
	hk   *hotkey.Hotkey
	stop chan struct{}
}

// rebuildHotkeys unregisters all existing hotkeys and registers new ones.
func (a *App) rebuildHotkeys() {
	log.Println("[REBUILD] rebuildHotkeys called")

	a.mu.Lock()
	// Unregister all
	for id, entry := range a.hotkeys {
		log.Println("[REBUILD]   unregistering id=", id)
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
		log.Println("[REBUILD]   registering id=", p.ID, "hotkey=", p.Hotkey)
		id := p.ID
		mods, key, err := parseHotkey(p.Hotkey)
		if err != nil {
			log.Println("[REBUILD]   parseHotkey failed id=", id, "hotkey=", p.Hotkey, "err=", err)
			continue
		}
		hk := hotkey.New(mods, key)
		if err := hk.Register(); err != nil {
			log.Println("[REBUILD]   Register failed id=", id, "hotkey=", p.Hotkey, "err=", err)
			continue
		}
		log.Println("[REBUILD]   successfully registered id=", id, "hotkey=", p.Hotkey)
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
					log.Println("[HOTKEY] Keydown fired id=", id, "hotkey=", p.Hotkey)
					a.mu.Lock()
					suspended := a.hotkeysSuspended
					a.mu.Unlock()
					if suspended {
						log.Println("[HOTKEY]   SUSPENDED, ignoring id=", id)
						continue
					}
					log.Println("[HOTKEY]   -> calling TogglePostitWindow id=", id)
					_ = a.TogglePostitWindow(id)
				}
			}
		}(hk, id, stop)
	}
	log.Println("[REBUILD] rebuildHotkeys done")
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
				log.Println("[PALETTE] Palette hotkey fired")
				a.mu.Lock()
				suspended := a.hotkeysSuspended
				a.mu.Unlock()
				if suspended {
					log.Println("[PALETTE]   SUSPENDED, ignoring")
					continue
				}
				log.Println("[PALETTE]   -> calling toggleCommandPalette")
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

// SetHotkeySuspended toggles whether the registered hotkey goroutines should
// fire their actions. The frontend calls this while the hotkey recorder is
// active so the key combo the user is trying to capture does not also toggle
// a postit window through the native Win32 hotkey channel.
func (a *App) SetHotkeySuspended(suspended bool) error {
	a.mu.Lock()
	a.hotkeysSuspended = suspended
	a.mu.Unlock()
	return nil
}
