import { useEffect } from "react";
import { Events } from "@wailsio/runtime";
import * as Backend from "../bindings/mycheet/app.js";
import CommandPalette from "./components/CommandPalette.jsx";
import Settings from "./components/Settings.jsx";
import PostitViewer from "./components/PostitViewer.jsx";
import { applyTheme, DEFAULT_THEME_ID, getStoredThemeId, resolveThemeId } from "./lib/theme.js";

const params = new URLSearchParams(window.location.search);
const MODE = params.get("mode");
const ID   = params.get("id");

export default function App() {
  useEffect(() => {
    Backend.GetTheme()
      .then(themeId => applyTheme(themeId || DEFAULT_THEME_ID))
      .catch(() => applyTheme(getStoredThemeId() || DEFAULT_THEME_ID));

    Events.On("theme-changed", payload => {
      applyTheme(resolveThemeId(payload));
    });
  }, []);

  if (MODE === "palette") return <CommandPalette />;
  if (MODE === "settings") return <Settings />;
  if (ID) return <PostitViewer id={ID} />;
  return null;
}
