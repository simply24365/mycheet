import { FolderOpen, FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SurfaceCard } from "./surface-card";

type Props = {
  autostart: boolean;
  baseDirInput: string;
  setBaseDirInput: (next: string) => void;
  onApplyBaseDir: () => void;
  onBrowseBaseDir: () => void;
  onOpenBaseDir: () => void;
  onAutostartChange: (next: boolean) => void;
};

export function GeneralPage({
  autostart,
  baseDirInput,
  setBaseDirInput,
  onApplyBaseDir,
  onBrowseBaseDir,
  onOpenBaseDir,
  onAutostartChange,
}: Props) {
  return (
    <div className="grid h-full auto-rows-min gap-2.5 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(270px,0.8fr)]">
      <SurfaceCard className="lg:col-span-1">
        <div className="mb-2 text-sm font-semibold tracking-tight text-foreground">기본 폴더</div>
        <Input
          value={baseDirInput}
          onChange={event => setBaseDirInput(event.target.value)}
          onKeyDown={event => event.key === "Enter" && onApplyBaseDir()}
          className="h-11 rounded-[6px] border-border/70 bg-background/80 px-4 text-sm shadow-none"
          placeholder="경로 입력"
        />
        <div className="mt-2 flex gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 rounded-[6px] border-border/70 bg-background/80"
            onClick={onBrowseBaseDir}
            title="폴더 선택">
            <FolderSearch size={15} />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 rounded-[6px] border-border/70 bg-background/80"
            onClick={onOpenBaseDir}
            title="탐색기에서 열기">
            <FolderOpen size={15} />
          </Button>
          <Button className="h-11 flex-1 rounded-[6px]" onClick={onApplyBaseDir}>
            적용
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="lg:col-span-1">
        <div className="mb-2 text-sm font-semibold tracking-tight text-foreground">시스템</div>
        <div className="flex w-full items-center justify-between rounded-[8px] border border-border/70 bg-background/80 px-3 py-2.5 transition-all duration-150 hover:border-primary/30 hover:bg-accent/35">
          <span className="text-sm font-medium text-foreground">부팅 시 자동 시작</span>
          <Switch
            checked={autostart}
            onCheckedChange={onAutostartChange}
            aria-label="부팅 시 자동 시작"
            className="data-[size=default]:h-6 data-[size=default]:w-11"
          />
        </div>
      </SurfaceCard>
    </div>
  );
}
