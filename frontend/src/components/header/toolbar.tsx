import { useRef } from "react";
import { UploadSimple, FloppyDisk, Export } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolbarProps {
  onFileSelect: (file: File) => void;
  canSave: boolean;
  canExport: boolean;
  onSave?: () => void;
  onExport?: () => void;
}

export function Toolbar({
  onFileSelect,
  canSave,
  canExport,
  onSave,
  onExport,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
          onChange={handleFileChange}
          className="hidden"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleUploadClick}
              aria-label="Upload file"
            >
              <UploadSimple className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Upload image or video</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canSave}
              onClick={onSave}
              aria-label="Save"
            >
              <FloppyDisk className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{canSave ? "Save PLY file" : "Process an image first"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canExport}
              onClick={onExport}
              aria-label="Export"
            >
              <Export className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{canExport ? "Export video" : "Process an image first"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
