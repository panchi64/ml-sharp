import { useRef } from "react";
import {
  FolderOpen,
  CaretDown,
  UploadSimple,
  FloppyDisk,
  Export,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <div className="flex items-center bg-card/80 backdrop-blur-sm rounded-full px-1 py-1 shadow-md ring-1 ring-border/50">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* File Menu Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full px-3 gap-1.5"
          >
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm">File</span>
            <CaretDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleUploadClick}>
            <UploadSimple className="h-4 w-4" />
            Open...
            <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canSave} onClick={onSave}>
            <FloppyDisk className="h-4 w-4" />
            Save PLY
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canExport} onClick={onExport}>
            <Export className="h-4 w-4" />
            Export Video
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
