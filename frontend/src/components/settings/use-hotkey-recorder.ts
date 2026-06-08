import { useEffect, useState } from "react";
import * as App from "@bindings/mycheet/app";

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

export type HotkeyRecorder = {
  hotkey: string;
  recording: boolean;
  start: () => void;
  stop: () => void;
  clear: () => void;
  set: (next: string) => void;
};

export function useHotkeyRecorder(initial = ""): HotkeyRecorder {
  const [hotkey, setHotkey] = useState(initial);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    // Suppress native Win32 hotkey firing so the key combo the user is
    // recording does not also toggle a postit window. Re-enabled on cleanup.
    App.SetHotkeySuspended(true).catch(() => undefined);

    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (MODIFIER_KEYS.has(event.key)) return;

      const parts: string[] = [];
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.shiftKey) parts.push("Shift");
      if (event.altKey) parts.push("Alt");
      if (event.metaKey) parts.push("Win");
      parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);

      setHotkey(parts.join("+"));
      setRecording(false);
    };

    document.addEventListener("keydown", handler, { capture: true });
    return () => {
      document.removeEventListener("keydown", handler, { capture: true });
      App.SetHotkeySuspended(false).catch(() => undefined);
    };
  }, [recording]);

  return {
    hotkey,
    recording,
    start: () => setRecording(true),
    stop: () => setRecording(false),
    clear: () => {
      setRecording(false);
      setHotkey("");
    },
    set: setHotkey,
  };
}
