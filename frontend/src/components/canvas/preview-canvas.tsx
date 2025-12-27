import { Play, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileExtension } from "@/lib/file-utils";
import type { FileType } from "@/lib/file-utils";

interface PreviewCanvasProps {
  file: File;
  previewUrl: string;
  fileType: FileType;
  isProcessing: boolean;
  onStartProcessing: () => void;
  onCancel: () => void;
}

export function PreviewCanvas({
  file,
  previewUrl,
  fileType,
  isProcessing,
  onStartProcessing,
  onCancel,
}: PreviewCanvasProps) {
  return (
    <div className="relative flex items-center justify-center h-full w-full bg-muted/30">
      {/* Preview media */}
      {fileType === "image" ? (
        <img
          src={previewUrl}
          alt={file.name}
          className={cn(
            "max-h-full max-w-full object-contain transition-opacity duration-300",
            isProcessing && "opacity-50"
          )}
        />
      ) : (
        <video
          src={previewUrl}
          className={cn(
            "max-h-full max-w-full object-contain transition-opacity duration-300",
            isProcessing && "opacity-50"
          )}
          controls={!isProcessing}
          muted
          loop
        />
      )}

      {/* Overlay for actions (only show when not processing) */}
      {!isProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200">
          <Button
            size="lg"
            onClick={onStartProcessing}
            className="gap-2 mb-4"
          >
            <Play className="h-5 w-5" weight="fill" />
            Start Processing
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-white hover:text-white hover:bg-white/20"
          >
            <X className="h-4 w-4 mr-1" />
            Choose different file
          </Button>
        </div>
      )}

      {/* File info badge */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full border">
        <span className="text-xs font-medium">
          {getFileExtension(file.name)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </span>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
