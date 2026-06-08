import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        "rounded-[10px] border border-white/10 bg-card/88 px-3 py-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.5)] backdrop-blur-xl",
        className
      )}>
      {children}
    </Card>
  );
}
