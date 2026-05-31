import { type CSSProperties, useState, useEffect, useCallback } from "react";
import { Events, Window } from "@wailsio/runtime";
import { SquarePen } from "lucide-react";
import { marked } from "marked";
import * as App from "../../bindings/mycheet/app";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const DRAG_REGION_STYLE = { "--wails-draggable": "drag" } as CSSProperties;
const NO_DRAG_REGION_STYLE = { "--wails-draggable": "no-drag" } as CSSProperties;

export default function PostitViewer({ id }: { id: string }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [error, setError] = useState("");

  const loadContent = useCallback(async () => {
    if (!id) return;
    try {
      const [info, body] = await Promise.all([
        App.GetPostItByID(id),
        App.GetContent(id),
      ]);
      if (info) {
        setTitle(info.title || "");
        setIsMarkdown(/\.md$/i.test(info.path || ""));
      }
      setContent(body || "");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => {
    loadContent();
    const offReload = Events.On("reload-content", loadContent);

    return () => {
      offReload?.();
    };
  }, [loadContent]);

  const handleClose = () => Window.Hide();
  const handleEdit = async () => {
    try {
      await App.OpenPostItInEditor(id);
    } catch (e) {
      alert("기본 편집기로 열기 실패: " + e);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border border-border bg-background">
      <div className="flex h-[30px] flex-shrink-0 items-center justify-between border-b border-border bg-muted px-3 select-none" style={DRAG_REGION_STYLE}>
        <span className="truncate text-xs font-semibold text-foreground" style={DRAG_REGION_STYLE}>
          {title}
        </span>
        <div className="ml-2 flex shrink-0 items-center gap-1" style={NO_DRAG_REGION_STYLE}>
          <Button
            onClick={handleEdit}
            title="기본 편집기로 열기"
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 rounded-[4px] text-muted-foreground hover:bg-accent hover:text-foreground">
            <SquarePen size={12} />
          </Button>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 rounded-[4px] text-sm font-bold leading-none text-muted-foreground hover:bg-accent hover:text-foreground">
            ×
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-x-hidden px-3 py-2 text-foreground">
        {error ? (
          <div className="rounded-[4px] border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
        ) : isMarkdown ? (
          <div
            className="md-content text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }} />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground" style={{ userSelect: "text" }}>
            {content}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}