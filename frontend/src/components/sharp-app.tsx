import { useState, useCallback, useEffect } from "react";
import { Toolbar } from "@/components/header/toolbar";
import { ProgressPill } from "@/components/header/progress-pill";
import { HeaderControls } from "@/components/header/header-controls";
import { DropZone } from "@/components/canvas/drop-zone";
import { PreviewCanvas } from "@/components/canvas/preview-canvas";
import { ViewerPlaceholder } from "@/components/canvas/viewer-placeholder";
import { useTheme } from "@/hooks/use-theme";
import { useMockProcessing } from "@/hooks/use-mock-processing";
import { getFileType, type FileType } from "@/lib/file-utils";
import type { AppState } from "@/lib/keybindings";

interface UploadedFile {
  file: File;
  previewUrl: string;
  type: FileType;
}

export function SharpApp() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const { preference, cycleTheme } = useTheme();

  const handleProcessingComplete = useCallback(() => {
    setAppState("results");
  }, []);

  const { isProcessing, progress, start, cancel } = useMockProcessing(
    handleProcessingComplete
  );

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const fileType = getFileType(file);
    if (!fileType) return;

    // Cleanup previous preview URL
    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setUploadedFile({ file, previewUrl, type: fileType });
    setAppState("preview");
  }, [uploadedFile]);

  // Handle start processing
  const handleStartProcessing = useCallback(() => {
    setAppState("processing");
    start();
  }, [start]);

  // Handle cancel (back to idle or preview)
  const handleCancel = useCallback(() => {
    if (isProcessing) {
      cancel();
    }

    // Cleanup preview URL
    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }

    setUploadedFile(null);
    setAppState("idle");
  }, [isProcessing, cancel, uploadedFile]);

  // Handle reset (back to idle from results)
  const handleReset = useCallback(() => {
    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }
    setUploadedFile(null);
    setAppState("idle");
  }, [uploadedFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open file (Cmd/Ctrl + O)
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        // Trigger file input click via toolbar
        const uploadBtn = document.querySelector('[aria-label="Upload file"]');
        if (uploadBtn instanceof HTMLElement) {
          uploadBtn.click();
        }
      }

      // Start processing (Enter in preview state)
      if (e.key === "Enter" && appState === "preview") {
        e.preventDefault();
        handleStartProcessing();
      }

      // Cancel (Escape)
      if (e.key === "Escape") {
        e.preventDefault();
        if (appState === "processing") {
          cancel();
          setAppState("preview");
        } else if (appState === "preview") {
          handleCancel();
        }
      }

      // Reset (R in results state)
      if (e.key === "r" && appState === "results" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appState, handleStartProcessing, handleCancel, handleReset, cancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uploadedFile?.previewUrl) {
        URL.revokeObjectURL(uploadedFile.previewUrl);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
        {/* Left: Toolbar */}
        <Toolbar
          onFileSelect={handleFileSelect}
          canSave={appState === "results"}
          canExport={appState === "results"}
        />

        {/* Center: Progress Pill */}
        <ProgressPill
          progress={progress}
          isVisible={appState === "processing"}
        />

        {/* Right: Controls */}
        <HeaderControls
          appState={appState}
          themePreference={preference}
          onCycleTheme={cycleTheme}
        />
      </header>

      {/* Canvas */}
      <main className="flex-1 overflow-hidden">
        {appState === "idle" && <DropZone onFileSelect={handleFileSelect} />}

        {(appState === "preview" || appState === "processing") &&
          uploadedFile && (
            <PreviewCanvas
              file={uploadedFile.file}
              previewUrl={uploadedFile.previewUrl}
              fileType={uploadedFile.type}
              isProcessing={isProcessing}
              onStartProcessing={handleStartProcessing}
              onCancel={handleCancel}
            />
          )}

        {appState === "results" && <ViewerPlaceholder onReset={handleReset} />}
      </main>
    </div>
  );
}
