import { useCallback, useEffect, useState } from "react";
import { Events, Window } from "@wailsio/runtime";
import { Keyboard, Palette, SlidersHorizontal } from "lucide-react";
import type { PostIt } from "@bindings/mycheet/models";
import { cn } from "@/lib/utils";
import { getFileName } from "@/lib/path";
import { DEFAULT_THEME_ID, resolveThemeId } from "@/lib/theme";
import { GeneralPage } from "./settings/GeneralPage";
import { KeymapPage, type KeymapRow } from "./settings/KeymapPage";
import { ThemePage } from "./settings/ThemePage";
import { SettingsTitleBar } from "./settings/title-bar";
import { useWindowState } from "./settings/use-window-state";
import { useHotkeyRecorder } from "./settings/use-hotkey-recorder";
import {
  applyBaseDir,
  attachExistingFile,
  browseBaseDir,
  deletePostitAndFile,
  loadBaseDirFiles,
  loadInitialSettings,
  loadPostits,
  openBaseDir,
  savePostitChanges,
  setAutostart,
  setTheme,
} from "./settings/api";

const SETTINGS_PAGES = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "keymap", label: "Shortcuts", icon: Keyboard },
  { id: "theme", label: "Theme", icon: Palette },
] as const;

type PageId = (typeof SETTINGS_PAGES)[number]["id"];

export default function Settings() {
  const { isMaximised, isWindowFocused } = useWindowState();

  const [activePage, setActivePage] = useState<PageId>("general");
  const [baseDirInput, setBaseDirInput] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [postits, setPostits] = useState<PostIt[]>([]);
  const [selected, setSelected] = useState<PostIt | null>(null);
  const [autostart, setAutostartState] = useState(false);
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);

  const recorder = useHotkeyRecorder();

  const loadAll = useCallback(async () => {
    const [nextPostits, nextFiles] = await Promise.all([loadPostits(), loadBaseDirFiles()]);
    setPostits(nextPostits);
    setFiles(nextFiles);
  }, []);

  useEffect(() => {
    loadInitialSettings()
      .then(({ baseDir, autostart: au, themeId: tid }) => {
        setBaseDirInput(baseDir);
        setAutostartState(au);
        setThemeId(tid || DEFAULT_THEME_ID);
      })
      .catch(() => undefined);
    loadAll();

    const offPostits = Events.On("postits-updated", loadAll);
    const offTheme = Events.On("theme-changed", payload => setThemeId(resolveThemeId(payload)));

    return () => {
      offPostits?.();
      offTheme?.();
    };
  }, [loadAll]);

  useEffect(() => {
    if (activePage !== "keymap") recorder.stop();
  }, [activePage, recorder]);

  const selectPostit = (postit: PostIt) => {
    setSelected(postit);
    recorder.set(postit.hotkey || "");
  };

  const handleAdd = async (filePath: string) => {
    const newPostit = await attachExistingFile(filePath);
    await loadAll();
    if (newPostit) setSelected(newPostit);
  };

  const handleSave = async () => {
    if (!selected) return;
    recorder.stop();
    const updated = await savePostitChanges(selected, recorder.hotkey);
    if (updated) setSelected(updated);
    await loadAll();
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await deletePostitAndFile(selected);
    if (ok) {
      setSelected(null);
      recorder.clear();
      await loadAll();
    }
  };

  const handleApplyBaseDir = async () => {
    if (await applyBaseDir(baseDirInput)) await loadAll();
  };

  const handleBrowseBaseDir = async () => {
    const dir = await browseBaseDir(baseDirInput);
    if (dir) setBaseDirInput(dir);
  };

  const handleOpenBaseDir = () => {
    openBaseDir();
  };

  const handleAutostartChange = async (nextValue: boolean) => {
    const actual = await setAutostart(nextValue, autostart);
    setAutostartState(actual);
  };

  const handleThemeSelect = async (nextThemeId: string) => {
    if (nextThemeId === themeId) return;
    const actual = await setTheme(nextThemeId, themeId);
    setThemeId(actual);
  };

  const handleMinimise = () => Window.Minimise().catch(() => undefined);
  const handleToggleMaximise = () => Window.ToggleMaximise().catch(() => undefined);
  const handleCloseWindow = () => Window.Close().catch(() => undefined);

  const rows: KeymapRow[] = buildRows(files, postits);
  const currentPage = SETTINGS_PAGES.find(page => page.id === activePage) || SETTINGS_PAGES[0];

  return (
    <div className="h-full w-full bg-background">
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)] text-foreground",
          isMaximised ? "rounded-none" : "rounded-[12px] border border-border/20"
        )}>
        <div className="pointer-events-none absolute inset-x-12 top-1 h-14 rounded-[12px] bg-primary/8 blur-2xl" />

        <SettingsTitleBar
          currentPageLabel={currentPage.label}
          isMaximised={isMaximised}
          isWindowFocused={isWindowFocused}
          onCloseWindow={handleCloseWindow}
          onMinimise={handleMinimise}
          onToggleMaximise={handleToggleMaximise}
        />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <aside
            className={cn(
              "flex w-[110px] shrink-0 flex-col border-r border-border/70 bg-background/78 px-3 py-3 backdrop-blur-2xl",
              isWindowFocused ? "opacity-100" : "opacity-90"
            )}>
            <div className="mb-3 flex h-9 items-center justify-center rounded-[8px] border border-white/10 bg-background/85 text-[11px] font-semibold tracking-[0.28em] shadow-sm">
              MC
            </div>

            <div className="flex flex-col gap-1.5">
              {SETTINGS_PAGES.map(page => (
                <PageButton
                  key={page.id}
                  page={page}
                  active={page.id === activePage}
                  onClick={() => setActivePage(page.id)}
                />
              ))}
            </div>
          </aside>

          <div className="min-w-0 flex-1 bg-background/62 backdrop-blur-xl">
            <main className="h-full min-h-0 p-3">
              {activePage === "general" ? (
                <GeneralPage
                  autostart={autostart}
                  baseDirInput={baseDirInput}
                  onApplyBaseDir={handleApplyBaseDir}
                  onAutostartChange={handleAutostartChange}
                  onBrowseBaseDir={handleBrowseBaseDir}
                  onOpenBaseDir={handleOpenBaseDir}
                  setBaseDirInput={setBaseDirInput}
                />
              ) : activePage === "keymap" ? (
                <KeymapPage
                  dHotkey={recorder.hotkey}
                  onAdd={handleAdd}
                  onClearHotkey={recorder.clear}
                  onDelete={handleDelete}
                  onOpenGeneral={() => setActivePage("general")}
                  onReload={loadAll}
                  onSave={handleSave}
                  onSelectPostit={selectPostit}
                  onToggleRecording={() => (recorder.recording ? recorder.stop() : recorder.start())}
                  recording={recorder.recording}
                  rows={rows}
                  selected={selected}
                  selectedFileName={selected ? getFileName(selected.path) : ""}
                />
              ) : (
                <ThemePage themeId={themeId} onSelectTheme={handleThemeSelect} />
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageButton({
  page,
  active,
  onClick,
}: {
  page: (typeof SETTINGS_PAGES)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = page.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-[8px] border px-2 py-2 text-[11px] font-medium transition-all duration-150",
        active
          ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
          : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/40 hover:text-foreground"
      )}>
      <Icon size={18} className={cn("transition-transform duration-150", active && "scale-105")} />
      <span>{page.label}</span>
    </button>
  );
}

function buildRows(files: string[], postits: PostIt[]): KeymapRow[] {
  const rows: KeymapRow[] = [];
  const seen = new Set<string>();
  files.forEach(filePath => {
    const postit = postits.find(existing => existing.path === filePath) || null;
    if (postit) seen.add(postit.id);
    rows.push({ filePath, postit });
  });
  postits.forEach(postit => {
    if (!seen.has(postit.id)) {
      rows.push({ filePath: postit.path, postit });
    }
  });
  return rows;
}
