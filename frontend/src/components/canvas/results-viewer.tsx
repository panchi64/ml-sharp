import { DownloadSimple, ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GaussianViewer } from "./gaussian-viewer";
import type { SplatData } from "@/lib/webgpu";
import type { FileType } from "@/lib/file-utils";

interface ResultsViewerProps {
  onReset: () => void;
  splatData: SplatData | null;
  fileType: FileType;
  onDownloadPly?: () => void;
}

export function ResultsViewer({
  onReset,
  splatData,
  fileType: _fileType,
  onDownloadPly,
}: ResultsViewerProps) {
  const canDownload = splatData !== null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full w-full p-6">
        {/* Full-width 3D Viewer */}
        <div className="flex-1 relative border-2 border-dashed border-muted-foreground/25 rounded-2xl bg-muted/20 overflow-hidden min-h-[300px]">
          <GaussianViewer
            splatData={splatData}
            className="absolute inset-0"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                disabled={!canDownload}
                onClick={onDownloadPly}
                className="gap-2"
              >
                <DownloadSimple className="h-4 w-4" />
                Download PLY
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{canDownload ? "Download the PLY file" : "Process an image first"}</p>
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
