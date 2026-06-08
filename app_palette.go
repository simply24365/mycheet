//go:build windows

package main

// GetPalettePostIts returns sticky notes ordered by recent open activity.
func (a *App) GetPalettePostIts() ([]PostIt, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.sortedPalettePostItsLocked(), nil
}

// markPostitRecent moves the given postit to the front of the recent list.
func (a *App) markPostitRecent(id string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.removeRecentPostitIDLocked(id)
	a.recentPostitIDs = append([]string{id}, a.recentPostitIDs...)
}

func (a *App) removeRecentPostitIDLocked(id string) {
	filtered := make([]string, 0, len(a.recentPostitIDs))
	for _, existingID := range a.recentPostitIDs {
		if existingID != id {
			filtered = append(filtered, existingID)
		}
	}
	a.recentPostitIDs = filtered
}

// sortedPalettePostItsLocked returns postits in recent-first then insertion order.
// Caller must hold a.mu.
func (a *App) sortedPalettePostItsLocked() []PostIt {
	byID := make(map[string]PostIt, len(a.cfg.PostIts))
	for _, postit := range a.cfg.PostIts {
		byID[postit.ID] = postit
	}

	result := make([]PostIt, 0, len(a.cfg.PostIts))
	seen := make(map[string]struct{}, len(a.cfg.PostIts))
	for _, id := range a.recentPostitIDs {
		postit, ok := byID[id]
		if !ok {
			continue
		}
		result = append(result, postit)
		seen[id] = struct{}{}
	}
	for _, postit := range a.cfg.PostIts {
		if _, ok := seen[postit.ID]; ok {
			continue
		}
		result = append(result, postit)
	}
	return result
}
