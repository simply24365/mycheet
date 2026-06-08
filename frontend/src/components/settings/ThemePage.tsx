import {
  COMMON_THEME_PRESETS,
  PASTEL_THEME_PRESETS,
  getThemePreset,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { SurfaceCard } from "./surface-card";

type Props = {
  themeId: string;
  onSelectTheme: (nextThemeId: string) => void;
};

export function ThemePage({ themeId, onSelectTheme }: Props) {
  const currentTheme = getThemePreset(themeId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <SurfaceCard>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold tracking-tight text-foreground">{currentTheme.name}</div>
          <div className="flex items-center gap-1.5">
            {[currentTheme.preview.background, currentTheme.preview.surface, currentTheme.preview.accent].map(color => (
              <span key={color} className="h-3 w-3 rounded-full border border-black/5" style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>

        <div className="mt-2.5 overflow-hidden rounded-[10px] border border-border/70 bg-background/85">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/60 px-3 py-2">
            <span className="text-xs font-semibold text-foreground">mycheet memo</span>
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <div className="space-y-2 px-3 py-2">
            <div className="h-3 w-20 rounded-[4px] bg-secondary" />
            <div className="h-3 w-full rounded-[4px] bg-muted" />
            <div className="h-3 w-4/5 rounded-[4px] bg-muted" />
            <div className="pt-2">
              <span className="inline-flex rounded-[4px] bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
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

function ThemeSection({
  title,
  presets,
  selectedThemeId,
  onSelectTheme,
}: {
  title: string;
  presets: ReturnType<typeof getThemePreset>[];
  selectedThemeId: string;
  onSelectTheme: (next: string) => void;
}) {
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
              "rounded-[8px] border border-border/70 bg-background/80 p-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm",
              theme.id === selectedThemeId && "border-primary/55 bg-accent/45 shadow-sm"
            )}>
            <div className="mb-2 grid grid-cols-4 gap-1">
              {[theme.preview.background, theme.preview.surface, theme.preview.accent, theme.preview.text].map(color => (
                <span key={color} className="h-5 rounded-[4px] border border-black/5" style={{ backgroundColor: color }} />
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
