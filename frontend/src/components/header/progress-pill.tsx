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
        "flex flex-col items-center justify-center transition-all duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="bg-muted rounded-full px-6 py-2 min-w-[280px] flex flex-col items-center gap-1.5">
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
