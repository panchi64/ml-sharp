import { useState, useCallback } from "react";
import { UploadSimple, Image, VideoCamera, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { validateFile } from "@/lib/file-utils";

interface DropZoneProps {
  onFileSelect: (file: File) => void;
}

export function DropZone({ onFileSelect }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error ?? "Invalid file");
        return;
      }
      setError(null);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFile(file);
      }
    };
    input.click();
  }, [handleFile]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-8">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center w-full max-w-lg aspect-video",
          "border-2 border-dashed rounded-2xl cursor-pointer",
          "transition-all duration-200 ease-out",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
          error && "border-destructive/50"
        )}
      >
        <UploadSimple
          className={cn(
            "h-12 w-12 mb-4 transition-colors",
            isDragOver ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-lg font-medium text-foreground mb-1">
          Drop image or video here
        </p>
        <p className="text-sm text-muted-foreground">or click to browse</p>
      </div>

      {/* File type badges */}
      <div className="flex items-center gap-4 mt-6">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">
              JPG
            </Badge>
            <Badge variant="secondary" className="text-xs">
              PNG
            </Badge>
            <Badge variant="secondary" className="text-xs">
              WebP
            </Badge>
            <Badge variant="secondary" className="text-xs">
              HEIC
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <VideoCamera className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">
              MP4
            </Badge>
            <Badge variant="secondary" className="text-xs">
              MOV
            </Badge>
            <Badge variant="secondary" className="text-xs">
              WebM
            </Badge>
          </div>
        </div>
      </div>

      {/* CUDA note */}
      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
        <Warning className="h-3.5 w-3.5" />
        <span>Video rendering requires NVIDIA GPU with CUDA</span>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
