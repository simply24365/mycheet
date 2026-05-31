import { useEffect } from "react";
import { Events } from "@wailsio/runtime";
import * as Backend from "../bindings/mycheet/app";
import CommandPalette from "./components/CommandPalette";
import Settings from "./components/Settings";
import PostitViewer from "./components/PostitViewer";
import { applyTheme, DEFAULT_THEME_ID, getStoredThemeId, resolveThemeId } from "./lib/theme";

const params = new URLSearchParams(window.location.search);
const MODE = params.get("mode");
const ID = params.get("id");

export default function App() {
  useEffect(() => {
    Backend.GetTheme()
      .then(themeId => applyTheme(themeId || DEFAULT_THEME_ID))
      .catch(() => applyTheme(getStoredThemeId() || DEFAULT_THEME_ID));

    const offThemeChanged = Events.On("theme-changed", payload => {
      applyTheme(resolveThemeId(payload));
    });

    return () => {
      offThemeChanged?.();
    };
  }, []);

  if (MODE === "palette") return <CommandPalette />;
  if (MODE === "settings") return <Settings />;
  if (ID) return <PostitViewer id={ID} />;
  return null;
}