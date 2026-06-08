import type { CSSProperties, ReactNode } from "react";
import { Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DRAG_REGION_STYLE = { "--wails-draggable": "drag" } as CSSProperties;
const NO_DRAG_REGION_STYLE = { "--wails-draggable": "no-drag" } as CSSProperties;

type Props = {
  currentPageLabel: string;
  isMaximised: boolean;
  isWindowFocused: boolean;
  onCloseWindow: () => void;
  onMinimise: () => void;
  onToggleMaximise: () => void;
};

export function SettingsTitleBar({
  currentPageLabel,
  isMaximised,
  isWindowFocused,
  onCloseWindow,
  onMinimise,
  onToggleMaximise,
}: Props) {
  return (
    <header
      className={cn(
        "relative z-10 flex h-[54px] items-center border-b border-border/70 pl-4",
        isWindowFocused ? "bg-background/62" : "bg-background/48"
      )}
      style={DRAG_REGION_STYLE}
      onDoubleClick={onToggleMaximise}>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[6px] border text-[11px] font-semibold tracking-[0.26em] transition-colors duration-150",
            isWindowFocused
              ? "border-primary/25 bg-primary/10 text-foreground"
              : "border-white/10 bg-background/75 text-muted-foreground"
          )}>
          MC
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight text-foreground">mycheet</div>
        </div>
        <div className="rounded-[6px] border border-white/10 bg-background/72 px-2.5 py-1 text-[11px] text-muted-foreground">
          {currentPageLabel}
        </div>
      </div>

      <div className="ml-auto flex h-full items-stretch" data-window-controls="true" style={NO_DRAG_REGION_STYLE}>
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

function TitleBarButton({
  children,
  className,
  onClick,
  title,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title: string;
  variant?: "default" | "close";
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onDoubleClick={event => event.stopPropagation()}
      style={NO_DRAG_REGION_STYLE}
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
