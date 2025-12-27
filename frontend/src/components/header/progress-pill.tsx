import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { ProcessingProgress } from "@/hooks/use-mock-processing";

interface ProgressPillProps {
  progress: ProcessingProgress | null;
  isVisible: boolean;
}

export function ProgressPill({ progress, isVisible }: ProgressPillProps) {
  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-4 pointer-events-none"
      )}
    >
      <div className="bg-card/80 backdrop-blur-sm rounded-full px-6 py-2 min-w-[280px] flex flex-col items-center gap-1.5 shadow-md ring-1 ring-border/50">
        <Progress
          value={progress?.overallProgress ?? 0}
          className="h-1.5 w-full"
        />
        <span className="text-xs text-muted-foreground">
          {progress?.stageLabel ?? "Starting..."}
        </span>
      </div>
    </div>
  );
}
