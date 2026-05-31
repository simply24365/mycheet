import { useState, useEffect, useCallback } from "react";
import { Events, Window } from "@wailsio/runtime";
import { SquarePen } from "lucide-react";
import { marked } from "marked";
import * as App from "../../bindings/mycheet/app.js";

export default function PostitViewer({ id }) {
  const [title,   setTitle]   = useState("");
  const [content, setContent] = useState("");
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [error,   setError]   = useState("");

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
    } catch(e) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => {
    loadContent();
    Events.On("reload-content", loadContent);
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
    <div className="flex flex-col w-full h-full overflow-hidden bg-background border border-border">

      {/* Title bar */}
      <div className="flex items-center justify-between px-3 h-[30px] bg-muted border-b border-border select-none flex-shrink-0"
        style={{ "--wails-draggable": "drag" }}>
        <span className="text-xs font-semibold text-foreground truncate"
          style={{ "--wails-draggable": "drag" }}>
          {title}
        </span>
        <div className="ml-2 flex items-center gap-1 shrink-0" style={{ "--wails-draggable": "no-drag" }}>
          <button
            onClick={handleEdit}
            title="기본 편집기로 열기"
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
            <SquarePen size={12} />
          </button>
          <button
            onClick={handleClose}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground text-sm font-bold leading-none transition-colors cursor-pointer">
            ×
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 text-foreground">
        {error ? (
          <div className="text-destructive text-xs p-2 bg-destructive/10 rounded border border-destructive/30">{error}</div>
        ) : isMarkdown ? (
          <div
            className="md-content text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: marked.parse(content) }} />
        ) : (
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-foreground"
            style={{ userSelect: "text" }}>
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
