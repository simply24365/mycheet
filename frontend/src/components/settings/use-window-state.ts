import { useCallback, useEffect, useState } from "react";
import { Events, Window } from "@wailsio/runtime";

const WINDOW_STATE_EVENTS = [
  "common:WindowMaximise",
  "common:WindowUnMaximise",
  "common:WindowRestore",
  "common:WindowShow",
];

export type WindowState = {
  isMaximised: boolean;
  isWindowFocused: boolean;
  refresh: () => Promise<void>;
};

export function useWindowState(): WindowState {
  const [isMaximised, setIsMaximised] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const refresh = useCallback(async () => {
    const [maximised, focused] = await Promise.all([
      Window.IsMaximised().catch(() => false),
      Window.IsFocused().catch(() => true),
    ]);
    setIsMaximised(!!maximised);
    setIsWindowFocused(focused !== false);
  }, []);

  useEffect(() => {
    refresh();
    const offs = WINDOW_STATE_EVENTS.map(eventName => Events.On(eventName, refresh));
    const offActive = Events.On("windows:WindowActive", () => setIsWindowFocused(true));
    const offInactive = Events.On("windows:WindowInactive", () => setIsWindowFocused(false));

    return () => {
      offs.forEach(off => off?.());
      offActive?.();
      offInactive?.();
    };
  }, [refresh]);

  return { isMaximised, isWindowFocused, refresh };
}
