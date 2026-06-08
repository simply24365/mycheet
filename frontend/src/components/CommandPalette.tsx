import { useEffect, useRef, useState } from "react";
import { Events } from "@wailsio/runtime";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import * as App from "@bindings/mycheet/app";
import type { PostIt } from "@bindings/mycheet/models";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getFileName } from "@/lib/path";
import { comparePaletteEntries, getBestMatch, type RankedEntry } from "./palette/search";

type PaletteItem = PostIt & { __fileName: string };

export default function CommandPalette() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [items, setItems] = useState<PostIt[]>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const resetPalette = async () => {
    const nextItems = await App.GetPalettePostIts().catch(() => []) as PostIt[];
    setItems(nextItems);
    setQuery("");
    setActiveIndex(0);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  useEffect(() => {
    resetPalette();
    const offOpened = Events.On("command-palette-opened", resetPalette);
    const offUpdated = Events.On("postits-updated", resetPalette);

    return () => {
      offOpened?.();
      offUpdated?.();
    };
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
  const filteredItems: PaletteItem[] = items
    .map((item, originalIndex): RankedEntry => {
      const fileName = getFileName(item.path) || item.title || "";
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

  const submitItem = async (item?: PaletteItem) => {
    if (!item) return;
    setQuery("");
    setActiveIndex(0);
    await App.TogglePalettePostIt(item.id);
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
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
      setQuery("");
      setActiveIndex(0);
      await App.HideCommandPalette().catch(() => undefined);
    }
  };

  return (
    <div className="flex h-full w-full items-start justify-center bg-transparent px-4 py-4 text-foreground">
      <Card className="flex h-full max-h-[360px] w-full max-w-[720px] flex-col overflow-hidden rounded-[12px] border border-border/80 bg-card/95 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.95)] backdrop-blur-sm">
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

        <ScrollArea className="flex-1 px-2 py-2">
          {filteredItems.length === 0 ? (
            <EmptyState />
          ) : (
            filteredItems.map((item, index) => (
              <PaletteRow
                key={item.id}
                ref={node => {
                  itemRefs.current[index] = node;
                }}
                item={item}
                isActive={index === activeIndex}
                onSelect={submitItem}
              />
            ))
          )}
        </ScrollArea>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <div className="truncate">최근 연 메모가 위에 오며, 검색하면 즉시 필터됩니다.</div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant="secondary" className="gap-1 font-normal"><CornerDownLeft size={12} /> 열기/닫기</Badge>
            <Badge variant="secondary" className="font-normal">↑↓ 순환 이동</Badge>
            <Badge variant="secondary" className="font-normal">Esc 닫기</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Search size={18} />
      <div className="text-sm font-medium">검색 결과가 없습니다</div>
      <div className="text-xs">다른 제목이나 경로로 다시 찾아보세요</div>
    </div>
  );
}

const PaletteRow = ({
  item,
  isActive,
  onSelect,
  ref,
}: {
  item: PaletteItem;
  isActive: boolean;
  onSelect: (item: PaletteItem) => void;
  ref: (node: HTMLButtonElement | null) => void;
}) => {
  const fileName = item.__fileName || getFileName(item.path) || item.title || "";
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "mb-1 flex w-full items-center gap-3 rounded-[8px] border px-4 py-3 text-left transition-colors last:mb-0",
        isActive
          ? "border-primary/40 bg-accent text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground"
      )}>
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border",
        isActive ? "border-primary/30 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground"
      )}>
        <FileText size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{item.title || fileName}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{fileName}</div>
      </div>
      <Badge variant="outline" className="hidden shrink-0 uppercase tracking-[0.22em] sm:inline-flex">
        toggle
      </Badge>
    </button>
  );
};
