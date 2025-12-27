import { Cube, VideoCamera, DownloadSimple, ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ViewerPlaceholderProps {
  onReset: () => void;
}

export function ViewerPlaceholder({ onReset }: ViewerPlaceholderProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full w-full p-6">
        {/* Main grid: 3D viewer and video */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 3D Viewer placeholder */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-2xl bg-muted/20">
            <Cube className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              3D Viewer
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Coming soon
            </p>
          </div>

          {/* Video player placeholder */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-2xl bg-muted/20">
            <VideoCamera className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Trajectory Video
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Requires NVIDIA GPU
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled className="gap-2">
                <DownloadSimple className="h-4 w-4" />
                Download PLY
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>PLY download coming soon</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled className="gap-2">
                <DownloadSimple className="h-4 w-4" />
                Download Video
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Video export coming soon (requires CUDA)</p>
            </TooltipContent>
          </Tooltip>

          <Button onClick={onReset} className="gap-2">
            <ArrowCounterClockwise className="h-4 w-4" />
            Process Another
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
