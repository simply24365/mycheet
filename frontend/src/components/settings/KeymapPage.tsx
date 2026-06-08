import { RefreshCw } from "lucide-react";
import type { PostIt } from "@bindings/mycheet/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getFileName } from "@/lib/path";
import { SurfaceCard } from "./surface-card";

export type KeymapRow = {
  filePath: string;
  postit: PostIt | null;
};

type Props = {
  rows: KeymapRow[];
  selected: PostIt | null;
  selectedFileName: string;
  dHotkey: string;
  recording: boolean;
  onAdd: (filePath: string) => void;
  onSelectPostit: (postit: PostIt) => void;
  onToggleRecording: () => void;
  onClearHotkey: () => void;
  onSave: () => void;
  onDelete: () => void;
  onReload: () => void;
  onOpenGeneral: () => void;
};

export function KeymapPage({
  rows,
  selected,
  selectedFileName,
  dHotkey,
  recording,
  onAdd,
  onSelectPostit,
  onToggleRecording,
  onClearHotkey,
  onSave,
  onDelete,
  onReload,
  onOpenGeneral,
}: Props) {
  return (
    <div className="grid h-full min-h-0 gap-2.5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <SurfaceCard className="min-h-0 overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <div className="text-sm font-semibold tracking-tight text-foreground">Memo Files</div>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-[6px]" onClick={onReload} title="새로고침">
              <RefreshCw size={14} />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {rows.length === 0 ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-4 text-center">
                <div className="text-sm text-muted-foreground">파일 없음</div>
                <Button variant="outline" className="rounded-[6px]" onClick={onOpenGeneral}>
                  General
                </Button>
              </div>
            ) : (
              rows.map(({ filePath, postit }) => {
                const fileName = getFileName(filePath);
                const isSelected = !!(selected && postit && selected.id === postit.id);

                return (
                  <div
                    key={filePath}
                    onClick={() => postit && onSelectPostit(postit)}
                    className={cn(
                      "border-b border-border/60 px-3 py-2 transition-colors duration-150",
                      postit ? "cursor-pointer hover:bg-accent/40" : "cursor-default opacity-70",
                      isSelected && "bg-accent/55"
                    )}>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="truncate text-xs font-medium leading-tight text-foreground" title={fileName}>
                        {fileName}
                      </span>
                      {postit?.hotkey ? (
                        <Badge variant="secondary" className="w-fit max-w-full truncate font-mono text-[10px]">
                          {postit.hotkey}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-fit rounded-[4px] px-2 text-[10px]"
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
          </ScrollArea>
        </div>
      </SurfaceCard>

      <SurfaceCard className="min-h-0 overflow-y-auto">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">메모 선택</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">파일</div>
              <div className="mt-0.5 truncate text-xs font-medium text-foreground" title={selectedFileName}>
                {selectedFileName}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">경로</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={selected.path}>{selected.path}</div>
            </div>

            <div className="border-t border-border/30" />

            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">단축키</div>
              <div className="mt-1.5 flex gap-1.5">
                <div
                  className={cn(
                    "flex h-7 min-w-0 flex-1 items-center rounded-[4px] border px-2.5 font-mono text-xs",
                    recording ? "border-primary bg-primary/5" : "border-border/70 bg-background/80"
                  )}>
                  {recording ? (
                    <span className="animate-pulse text-muted-foreground">키 입력</span>
                  ) : (
                    <span className={cn("truncate", !dHotkey && "text-muted-foreground")}>{dHotkey || "없음"}</span>
                  )}
                </div>
                <Button size="sm" className="h-7 shrink-0 rounded-[4px] px-2.5 text-[11px]" variant={recording ? "outline" : "secondary"} onClick={onToggleRecording}>
                  {recording ? "취소" : "녹화"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 shrink-0 rounded-[4px] px-2.5 text-[11px]" onClick={onClearHotkey}>
                  지우기
                </Button>
              </div>
            </div>

            <div className="flex gap-1.5">
              <Button className="h-7 flex-1 rounded-[4px] text-xs" onClick={onSave}>저장</Button>
              <Button variant="destructive" className="h-7 rounded-[4px] px-3 text-xs" onClick={onDelete}>삭제</Button>
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
