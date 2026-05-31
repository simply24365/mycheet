import { useEffect, useRef, useState } from "react";
import { Events } from "@wailsio/runtime";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import * as App from "../../bindings/mycheet/app.js";
import { Input } from "./ui/input.jsx";
import { cn } from "../lib/utils.js";

export default function CommandPalette() {
  const inputRef = useRef(null);
  const itemRefs = useRef([]);

  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const loadItems = async () => {
    const nextItems = await App.GetPalettePostIts().catch(() => []);
    setItems(Array.isArray(nextItems) ? nextItems : []);
  };

  const resetPalette = async () => {
    await loadItems();
    setQuery("");
    setActiveIndex(0);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  useEffect(() => {
    resetPalette();
    Events.On("command-palette-opened", resetPalette);
    Events.On("postits-updated", loadItems);
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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items
    .map((item, originalIndex) => {
      const fileName = (item.path || "").replace(/\\/g, "/").split("/").pop() || item.title || "";
      const match = getBestMatch(item, fileName, normalizedQuery);
      return { item, fileName, originalIndex, match };
    })
    .filter(entry => !normalizedQuery || entry.match !== null)
    .sort((left, right) => comparePaletteEntries(left, right, normalizedQuery))
    .map(entry => ({ ...entry.item, __fileName: entry.fileName }));

  useEffect(() => {
    if (filteredItems.length === 0) {
      if (activeIndex !== 0) setActiveIndex(0);
      return;
    }
    if (activeIndex >= filteredItems.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredItems.length]);

  useEffect(() => {
    const target = itemRefs.current[activeIndex];
    target?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filteredItems.length]);

  const submitItem = async (item) => {
    if (!item) return;
    setQuery("");
    setActiveIndex(0);
    await App.TogglePalettePostIt(item.id);
  };

  const hidePalette = async () => {
    setQuery("");
    setActiveIndex(0);
    await App.HideCommandPalette().catch(() => {});
  };

  const handleKeyDown = async (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredItems.length === 0) return;
      setActiveIndex(current => (current + 1) % filteredItems.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredItems.length === 0) return;
      setActiveIndex(current => (current - 1 + filteredItems.length) % filteredItems.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      await submitItem(filteredItems[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      await hidePalette();
    }
  };

  return (
    <div className="flex h-full w-full items-start justify-center bg-transparent px-4 py-4 text-foreground">
      <div className="flex h-full max-h-[360px] w-full max-w-[720px] flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl shadow-black/45 backdrop-blur-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 bg-card px-1 py-1">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="메모 제목 또는 경로 검색"
              className="h-auto border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filteredItems.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Search size={18} />
              <div className="text-sm font-medium">검색 결과가 없습니다</div>
              <div className="text-xs">다른 제목이나 경로로 다시 찾아보세요</div>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const fileName = item.__fileName || (item.path || "").replace(/\\/g, "/").split("/").pop() || item.title;
              const isActive = index === activeIndex;

              return (
                <button
                  key={item.id}
                  ref={node => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  onClick={() => submitItem(item)}
                  className={cn(
                    "mb-1 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors last:mb-0",
                    isActive
                      ? "border-primary/40 bg-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground"
                  )}>
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    isActive ? "border-primary/30 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground"
                  )}>
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{item.title || fileName}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{fileName}</div>
                  </div>
                  <div className="hidden shrink-0 text-[10px] uppercase tracking-[0.24em] text-muted-foreground sm:block">
                    toggle
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <div className="truncate">최근 연 메모가 위에 오며, 검색하면 즉시 필터됩니다.</div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1"><CornerDownLeft size={12} /> 열기/닫기</span>
            <span>↑↓ 순환 이동</span>
            <span>Esc 닫기</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getBestMatch(item, fileName, query) {
  if (!query) return null;

  const fields = [
    { value: String(item.title || "").toLowerCase(), fieldPriority: 0 },
    { value: String(fileName || "").toLowerCase(), fieldPriority: 1 },
    { value: String(item.path || "").toLowerCase(), fieldPriority: 2 },
  ];

  const matches = fields
    .map(field => scoreMatch(field.value, query, field.fieldPriority))
    .filter(Boolean)
    .sort(compareMatches);

  return matches[0] || null;
}

function scoreMatch(value, query, fieldPriority) {
  const index = value.indexOf(query);
  if (index === -1) return null;

  const previous = index > 0 ? value[index - 1] : "";
  const boundary = index === 0 || /[\s_./\\\-[\](){}]/.test(previous);
  const prefixRank = index === 0 ? 0 : boundary ? 1 : 2;

  return {
    prefixRank,
    index,
    length: value.length,
    fieldPriority,
  };
}

function compareMatches(left, right) {
  if (left.prefixRank !== right.prefixRank) return left.prefixRank - right.prefixRank;
  if (left.fieldPriority !== right.fieldPriority) return left.fieldPriority - right.fieldPriority;
  if (left.index !== right.index) return left.index - right.index;
  return left.length - right.length;
}

function comparePaletteEntries(left, right, query) {
  if (!query) return left.originalIndex - right.originalIndex;
  const matchCompare = compareMatches(left.match, right.match);
  if (matchCompare !== 0) return matchCompare;
  return left.originalIndex - right.originalIndex;
}