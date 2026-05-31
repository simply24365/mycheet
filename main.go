package main

import (
	"embed"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	svc := NewApp()

	app := application.New(application.Options{
		Name:        appName,
		Description: "Sticky notes app",
		Icon:        appIcon,
		Services: []application.Service{
			application.NewService(svc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: appName + "-single-instance-1e8f2a3b",
			OnSecondInstanceLaunch: func(_ application.SecondInstanceData) {
				if svc.settingsWin != nil {
					svc.settingsWin.Show()
					svc.settingsWin.Focus()
				}
			},
		},
	})

	settingsWin := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            appName + " 설정",
		Width:            920,
		Height:           660,
		MinWidth:         760,
		MinHeight:        540,
		Frameless:        true,
		URL:              "/?mode=settings",
		Hidden:           true,
		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		Windows: application.WindowsWindow{
			Theme: application.SystemDefault,
		},
	})
	svc.settingsWin = settingsWin
	settingsWin.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		event.Cancel()
		settingsWin.Hide()
	})

	paletteWin := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            appName + " Palette",
		Width:            680,
		Height:           420,
		Frameless:        true,
		AlwaysOnTop:      true,
		Hidden:           true,
		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		HideOnEscape:     true,
		URL:              "/?mode=palette",
		Windows: application.WindowsWindow{
			Theme:           application.SystemDefault,
			HiddenOnTaskbar: true,
		},
	})
	svc.paletteWin = paletteWin
	paletteWin.OnWindowEvent(events.Common.WindowClosing, func(event *application.WindowEvent) {
		event.Cancel()
		paletteWin.Hide()
	})

	showSettingsWindow := func() {
		settingsWin.Show().Focus()
	}

	var lastTrayClick time.Time
	const trayDoubleClickThreshold = 450 * time.Millisecond

	tray := app.SystemTray.New()
	tray.SetIcon(appIcon)
	tray.SetTooltip(appName)
	menu := application.NewMenu()
	menu.Add("설정").OnClick(func(_ *application.Context) {
		showSettingsWindow()
	})
	menu.AddSeparator()
	menu.Add("종료").OnClick(func(_ *application.Context) {
		app.Quit()
	})
	tray.SetMenu(menu)
	tray.OnClick(func() {
		now := time.Now()
		if !lastTrayClick.IsZero() && now.Sub(lastTrayClick) <= trayDoubleClickThreshold {
			lastTrayClick = time.Time{}
			showSettingsWindow()
			return
		}
		lastTrayClick = now
	})
	tray.OnDoubleClick(func() {
		lastTrayClick = time.Time{}
		showSettingsWindow()
	})

	svc.Init()

	// Run the application. This blocks until the application has been exited.
	err := app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}
