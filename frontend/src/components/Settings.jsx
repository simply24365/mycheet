import { useCallback, useEffect, useState } from "react";
import { Events, Window } from "@wailsio/runtime";
import { FolderOpen, FolderSearch, Keyboard, Minus, Palette, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import * as App from "../../bindings/mycheet/app.js";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { cn } from "../lib/utils.js";
import {
  COMMON_THEME_PRESETS,
  DEFAULT_THEME_ID,
  PASTEL_THEME_PRESETS,
  getThemePreset,
  resolveThemeId,
} from "../lib/theme.js";

const SETTINGS_PAGES = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "keymap", label: "Shortcuts", icon: Keyboard },
  { id: "theme", label: "Theme", icon: Palette },
];

const WINDOW_STATE_EVENTS = [
  "common:WindowMaximise",
  "common:WindowUnMaximise",
  "common:WindowRestore",
  "common:WindowShow",
];

export default function Settings() {
  const [activePage, setActivePage] = useState("general");
  const [baseDirInput, setBaseDirInput] = useState("");
  const [files, setFiles] = useState([]);
  const [postits, setPostits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dHotkey, setDHotkey] = useState("");
  const [recording, setRecording] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [isMaximised, setIsMaximised] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const loadAll = useCallback(async () => {
    const [nextPostits, nextFiles] = await Promise.all([
      App.GetPostIts().catch(() => []),
      App.ListBaseDirFiles().catch(() => []),
    ]);
    setPostits(Array.isArray(nextPostits) ? nextPostits : []);
    setFiles(Array.isArray(nextFiles) ? nextFiles : []);
  }, []);

  const syncWindowState = useCallback(async () => {
    const [maximised, focused] = await Promise.all([
      Window.IsMaximised().catch(() => false),
      Window.IsFocused().catch(() => true),
    ]);
    setIsMaximised(!!maximised);
    setIsWindowFocused(focused !== false);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById("app");
    const previous = {
      htmlBackground: html.style.background,
      bodyBackground: body.style.background,
      appBackground: appRoot?.style.background || "",
    };

    html.style.background = "transparent";
    body.style.background = "transparent";
    if (appRoot) {
      appRoot.style.background = "transparent";
    }

    return () => {
      html.style.background = previous.htmlBackground;
      body.style.background = previous.bodyBackground;
      if (appRoot) {
        appRoot.style.background = previous.appBackground;
      }
    };
  }, []);

  useEffect(() => {
    App.GetBaseDir().then(dir => setBaseDirInput(dir || ""));
    App.GetAutostartEnabled().then(enabled => setAutostart(!!enabled));
    App.GetTheme().then(id => setThemeId(id || DEFAULT_THEME_ID));
    loadAll();
    syncWindowState();

    const offPostits = Events.On("postits-updated", loadAll);
    const offTheme = Events.On("theme-changed", payload => setThemeId(resolveThemeId(payload)));

    return () => {
      offPostits?.();
      offTheme?.();
    };
  }, [loadAll, syncWindowState]);

  useEffect(() => {
    const offWindowEvents = WINDOW_STATE_EVENTS.map(eventName => Events.On(eventName, syncWindowState));
    const offActive = Events.On("windows:WindowActive", () => setIsWindowFocused(true));
    const offInactive = Events.On("windows:WindowInactive", () => setIsWindowFocused(false));

    return () => {
      offWindowEvents.forEach(off => off?.());
      offActive?.();
      offInactive?.();
    };
  }, [syncWindowState]);

  useEffect(() => {
    if (activePage !== "keymap") {
      setRecording(false);
    }
  }, [activePage]);

  useEffect(() => {
    if (!recording) return;

    const handler = event => {
      event.preventDefault();
      event.stopPropagation();
      if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return;

      const parts = [];
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.shiftKey) parts.push("Shift");
      if (event.altKey) parts.push("Alt");
      if (event.metaKey) parts.push("Win");
      parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);

      setDHotkey(parts.join("+"));
      setRecording(false);
    };

    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [recording]);

  const selectPostit = postit => {
    setRecording(false);
    setSelected(postit);
    setDHotkey(postit.hotkey || "");
  };

  const handleAdd = async filePath => {
    const name = filePath.replace(/\\/g, "/").split("/").pop();
    const title = name.replace(/\.(md|txt)$/i, "");
    try {
      const newPostit = await App.AddPostItWithPath(title, filePath);
      await loadAll();
      if (newPostit) selectPostit(newPostit);
    } catch (e) {
      alert("추가 실패: " + e);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setRecording(false);
    const name = (selected.path || "").replace(/\\/g, "/").split("/").pop();
    const title = name.replace(/\.(md|txt)$/i, "");
    const updated = { id: selected.id, title, path: selected.path, hotkey: dHotkey };
    try {
      await App.UpdatePostIt(updated);
      setSelected({ ...selected, hotkey: dHotkey });
      await loadAll();
    } catch (e) {
      alert("저장 실패: " + e);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const name = (selected.path || "").replace(/\\/g, "/").split("/").pop();
    if (!confirm(`"${name}" 파일을 포스트잇 목록에서 제거하고 디스크에서도 삭제할까요?`)) return;
    try {
      await App.DeletePostItAndFile(selected.id);
      setSelected(null);
      setDHotkey("");
      await loadAll();
    } catch (e) {
      alert("삭제 실패: " + e);
    }
  };

  const handleApplyBaseDir = async () => {
    try {
      await App.SetBaseDir(baseDirInput);
      await loadAll();
    } catch (e) {
      alert("오류: " + e);
    }
  };

  const handleBrowseBaseDir = async () => {
    try {
      const dir = await App.BrowseBaseDir();
      if (dir) setBaseDirInput(dir);
    } catch (e) {
      // cancelled
    }
  };

  const handleOpenBaseDir = async () => {
    try {
      await App.OpenBaseDir();
    } catch (e) {
      alert("폴더 열기 실패: " + e);
    }
  };

  const handleAutostartChange = async nextValue => {
    const previousValue = autostart;
    setAutostart(nextValue);
    try {
      await App.SetAutostartEnabled(nextValue);
    } catch (e) {
      setAutostart(previousValue);
      alert("설정 변경 실패: " + e);
    }
  };

  const handleThemeSelect = async nextThemeId => {
    if (nextThemeId === themeId) return;
    const previousThemeId = themeId;
    setThemeId(nextThemeId);
    try {
      await App.SetTheme(nextThemeId);
    } catch (e) {
      setThemeId(previousThemeId);
      alert("테마 변경 실패: " + e);
    }
  };

  const handleMinimise = () => Window.Minimise().catch(() => undefined);
  const handleToggleMaximise = () => Window.ToggleMaximise().catch(() => undefined);
  const handleCloseWindow = () => Window.Close().catch(() => undefined);

  const rows = [];
  const seen = new Set();
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

  const selectedFileName = selected
    ? (selected.path || "").replace(/\\/g, "/").split("/").pop()
    : "";

  const currentPage = SETTINGS_PAGES.find(page => page.id === activePage) || SETTINGS_PAGES[0];
  const currentTheme = getThemePreset(themeId);

  return (
    <div className={cn("h-full w-full bg-transparent", isMaximised ? "p-0" : "p-2.5")}>
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)] text-foreground",
          isMaximised
            ? "rounded-none border border-transparent shadow-none"
            : "rounded-[30px] border border-border/70 shadow-[0_28px_70px_-38px_rgba(0,0,0,0.78)]"
        )}>
        <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-primary/12 blur-3xl" />

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
              "flex w-[110px] shrink-0 flex-col border-r border-border/70 bg-background/78 px-3 py-4 backdrop-blur-2xl",
              isWindowFocused ? "opacity-100" : "opacity-90"
            )}>
            <div className="mb-4 flex h-11 items-center justify-center rounded-[18px] border border-white/10 bg-background/85 text-[11px] font-semibold tracking-[0.28em] shadow-sm">
              MC
            </div>

            <div className="flex flex-col gap-2">
              {SETTINGS_PAGES.map(page => {
                const Icon = page.icon;
                const isActive = page.id === activePage;
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setActivePage(page.id)}
                    className={cn(
                      "flex w-full flex-col items-center gap-1.5 rounded-[22px] border px-2 py-3 text-[11px] font-medium transition-all duration-150",
                      isActive
                        ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
                        : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/40 hover:text-foreground"
                    )}>
                    <Icon size={18} className={cn("transition-transform duration-150", isActive && "scale-105")} />
                    <span>{page.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto rounded-[20px] border border-white/10 bg-background/70 px-3 py-3 text-center backdrop-blur-xl">
              <div className="truncate text-[11px] font-medium text-foreground">{currentTheme.name}</div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 bg-background/62 backdrop-blur-xl">
            <main className="h-full min-h-0 p-4">
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
                  dHotkey={dHotkey}
                  onAdd={handleAdd}
                  onClearHotkey={() => {
                    setRecording(false);
                    setDHotkey("");
                  }}
                  onDelete={handleDelete}
                  onOpenGeneral={() => setActivePage("general")}
                  onReload={loadAll}
                  onSave={handleSave}
                  onSelectPostit={selectPostit}
                  onToggleRecording={() => setRecording(value => !value)}
                  recording={recording}
                  rows={rows}
                  selected={selected}
                  selectedFileName={selectedFileName}
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

function SettingsTitleBar({
  currentPageLabel,
  isMaximised,
  isWindowFocused,
  onCloseWindow,
  onMinimise,
  onToggleMaximise,
}) {
  return (
    <header
      className={cn(
        "relative z-10 flex h-[54px] items-center border-b border-border/70 pl-4",
        isWindowFocused ? "bg-background/62" : "bg-background/48"
      )}
      style={{ "--wails-draggable": "drag" }}
      onDoubleClick={onToggleMaximise}>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[14px] border text-[11px] font-semibold tracking-[0.26em] transition-colors duration-150",
            isWindowFocused
              ? "border-primary/25 bg-primary/10 text-foreground"
              : "border-white/10 bg-background/75 text-muted-foreground"
          )}>
          MC
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight text-foreground">mycheet</div>
        </div>
        <div className="rounded-full border border-white/10 bg-background/72 px-2.5 py-1 text-[11px] text-muted-foreground">
          {currentPageLabel}
        </div>
      </div>

      <div className="ml-auto flex h-full items-stretch" data-window-controls="true" style={{ "--wails-draggable": "no-drag" }}>
        <TitleBarButton title="최소화" onClick={onMinimise}>
          <Minus size={14} strokeWidth={1.8} />
        </TitleBarButton>
        <TitleBarButton title={isMaximised ? "복원" : "최대화"} onClick={onToggleMaximise}>
          {isMaximised ? <RestoreGlyph /> : <MaximiseGlyph />}
        </TitleBarButton>
        <TitleBarButton title="닫기" variant="close" onClick={onCloseWindow}>
          <X size={14} strokeWidth={1.8} />
        </TitleBarButton>
      </div>
    </header>
  );
}

function GeneralPage({
  autostart,
  baseDirInput,
  onApplyBaseDir,
  onAutostartChange,
  onBrowseBaseDir,
  onOpenBaseDir,
  setBaseDirInput,
}) {
  return (
    <div className="grid h-full auto-rows-min gap-4 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(270px,0.8fr)]">
      <SurfaceCard className="lg:col-span-1">
        <div className="mb-4 text-sm font-semibold tracking-tight text-foreground">기본 폴더</div>
        <Input
          value={baseDirInput}
          onChange={event => setBaseDirInput(event.target.value)}
          onKeyDown={event => event.key === "Enter" && onApplyBaseDir()}
          className="h-11 rounded-[18px] border-border/70 bg-background/80 px-4 text-sm shadow-none"
          placeholder="경로 입력"
        />
        <div className="mt-3 flex gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 rounded-[18px] border-border/70 bg-background/80"
            onClick={onBrowseBaseDir}
            title="폴더 선택">
            <FolderSearch size={15} />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 rounded-[18px] border-border/70 bg-background/80"
            onClick={onOpenBaseDir}
            title="탐색기에서 열기">
            <FolderOpen size={15} />
          </Button>
          <Button className="h-11 flex-1 rounded-[18px]" onClick={onApplyBaseDir}>
            적용
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="lg:col-span-1">
        <div className="mb-4 text-sm font-semibold tracking-tight text-foreground">시스템</div>
        <button
          type="button"
          role="switch"
          aria-checked={autostart}
          onClick={() => onAutostartChange(!autostart)}
          className="flex w-full items-center justify-between rounded-[22px] border border-border/70 bg-background/80 px-4 py-4 text-left transition-all duration-150 hover:border-primary/30 hover:bg-accent/35">
          <span className="text-sm font-medium text-foreground">부팅 시 자동 시작</span>
          <span className={cn("relative h-6 w-11 rounded-full transition-colors duration-150", autostart ? "bg-primary" : "bg-muted")}>
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150",
                autostart ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </span>
        </button>
      </SurfaceCard>
    </div>
  );
}

function KeymapPage({
  dHotkey,
  onAdd,
  onClearHotkey,
  onDelete,
  onOpenGeneral,
  onReload,
  onSave,
  onSelectPostit,
  onToggleRecording,
  recording,
  rows,
  selected,
  selectedFileName,
}) {
  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <SurfaceCard className="min-h-0 overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="text-sm font-semibold tracking-tight text-foreground">Memo Files</div>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={onReload} title="새로고침">
              <RefreshCw size={14} />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <div className="text-sm text-muted-foreground">파일 없음</div>
                <Button variant="outline" className="rounded-full" onClick={onOpenGeneral}>
                  General
                </Button>
              </div>
            ) : (
              rows.map(({ filePath, postit }) => {
                const fileName = filePath.replace(/\\/g, "/").split("/").pop();
                const isSelected = !!(selected && postit && selected.id === postit.id);

                return (
                  <div
                    key={filePath}
                    onClick={() => postit && onSelectPostit(postit)}
                    className={cn(
                      "border-b border-border/60 px-4 py-3 transition-colors duration-150",
                      postit ? "cursor-pointer hover:bg-accent/40" : "cursor-default opacity-70",
                      isSelected && "bg-accent/55"
                    )}>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="truncate text-xs font-medium leading-tight text-foreground" title={fileName}>
                        {fileName}
                      </span>
                      {postit?.hotkey ? (
                        <span className="w-fit max-w-full truncate rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-secondary-foreground">
                          {postit.hotkey}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-fit rounded-full px-2 text-[10px]"
                          onClick={event => {
                            event.stopPropagation();
                            onAdd(filePath);
                          }}>
                          연결
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="min-h-0 overflow-y-auto">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">메모 선택</div>
        ) : (
          <div className="flex flex-col gap-3">
            <InfoTile label="파일">
              <div className="truncate text-sm font-medium text-foreground" title={selectedFileName}>
                {selectedFileName}
              </div>
            </InfoTile>

            <InfoTile label="경로">
              <div className="break-all text-[12px] leading-relaxed text-muted-foreground">{selected.path}</div>
            </InfoTile>

            <InfoTile label="단축키">
              <div className="flex flex-wrap gap-2">
                <div
                  className={cn(
                    "flex min-h-[42px] min-w-[112px] flex-1 items-center rounded-[18px] border px-3 font-mono text-sm",
                    recording ? "border-primary bg-primary/5" : "border-border/70 bg-background/80"
                  )}>
                  {recording ? (
                    <span className="animate-pulse text-xs text-muted-foreground">키 입력</span>
                  ) : (
                    <span className={cn("truncate", !dHotkey && "text-muted-foreground")}>{dHotkey || "없음"}</span>
                  )}
                </div>
                <Button size="sm" className="h-10 rounded-[18px] px-3 text-xs" variant={recording ? "outline" : "secondary"} onClick={onToggleRecording}>
                  {recording ? "취소" : "녹화"}
                </Button>
                <Button size="sm" variant="outline" className="h-10 rounded-[18px] px-3 text-xs" onClick={onClearHotkey}>
                  지우기
                </Button>
              </div>
            </InfoTile>

            <div className="flex gap-2 pt-1">
              <Button className="h-10 flex-1 rounded-[18px]" onClick={onSave}>
                저장
              </Button>
              <Button variant="destructive" className="h-10 rounded-[18px] px-4" onClick={onDelete}>
                삭제
              </Button>
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

function ThemePage({ themeId, onSelectTheme }) {
  const currentTheme = getThemePreset(themeId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <SurfaceCard>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold tracking-tight text-foreground">{currentTheme.name}</div>
          <div className="flex items-center gap-1.5">
            {[currentTheme.preview.background, currentTheme.preview.surface, currentTheme.preview.accent].map(color => (
              <span key={color} className="h-3 w-3 rounded-full border border-black/5" style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-border/70 bg-background/85">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/60 px-3 py-2">
            <span className="text-xs font-semibold text-foreground">mycheet memo</span>
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <div className="space-y-2 px-3 py-3">
            <div className="h-3 w-20 rounded-full bg-secondary" />
            <div className="h-3 w-full rounded-full bg-muted" />
            <div className="h-3 w-4/5 rounded-full bg-muted" />
            <div className="pt-2">
              <span className="inline-flex rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                accent
              </span>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <ThemeSection title="보편적인 24색" presets={COMMON_THEME_PRESETS} selectedThemeId={themeId} onSelectTheme={onSelectTheme} />
      <ThemeSection title="파스텔 24색" presets={PASTEL_THEME_PRESETS} selectedThemeId={themeId} onSelectTheme={onSelectTheme} />
    </div>
  );
}

function ThemeSection({ title, presets, selectedThemeId, onSelectTheme }) {
  return (
    <SurfaceCard>
      <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">{title}</h3>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-2.5">
        {presets.map(theme => (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelectTheme(theme.id)}
            className={cn(
              "rounded-[20px] border border-border/70 bg-background/80 p-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm",
              theme.id === selectedThemeId && "border-primary/55 bg-accent/45 shadow-sm"
            )}>
            <div className="mb-2 grid grid-cols-4 gap-1">
              {[theme.preview.background, theme.preview.surface, theme.preview.accent, theme.preview.text].map(color => (
                <span key={color} className="h-5 rounded-[10px] border border-black/5" style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-foreground">{theme.name}</span>
              {theme.id === selectedThemeId && <span className="h-2 w-2 rounded-full bg-primary" />}
            </div>
          </button>
        ))}
      </div>
    </SurfaceCard>
  );
}

function SurfaceCard({ children, className }) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/10 bg-card/88 p-4 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.55)] backdrop-blur-2xl",
        className
      )}>
      {children}
    </section>
  );
}

function InfoTile({ children, className, label }) {
  return (
    <div className={cn("rounded-[22px] border border-border/70 bg-background/80 p-3", className)}>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TitleBarButton({ children, className, onClick, title, variant = "default" }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onDoubleClick={event => event.stopPropagation()}
      className={cn(
        "flex h-full w-[48px] items-center justify-center text-muted-foreground transition-colors duration-150",
        variant === "close"
          ? "hover:bg-[#e81123] hover:text-white"
          : "hover:bg-white/8 hover:text-foreground",
        className
      )}>
      {children}
    </button>
  );
}

function MaximiseGlyph() {
  return <span className="block h-[10px] w-[10px] border border-current" />;
}

function RestoreGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 1.5H10.5V8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1.5 4H8V10.5H1.5Z" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
