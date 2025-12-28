import { useState, useCallback, useEffect } from "react";
import { Toolbar } from "@/components/header/toolbar";
import { ProgressPill } from "@/components/header/progress-pill";
import { HeaderControls } from "@/components/header/header-controls";
import { DropZone } from "@/components/canvas/drop-zone";
import { PreviewCanvas } from "@/components/canvas/preview-canvas";
import { ResultsViewer } from "@/components/canvas/results-viewer";
import { useTheme } from "@/hooks/use-theme";
import { useProcessing } from "@/hooks/use-processing";
import { getFileType, type FileType } from "@/lib/file-utils";
import type { AppState } from "@/lib/keybindings";
import type { SplatData } from "@/lib/webgpu";

interface UploadedFile {
  file: File;
  previewUrl: string;
  type: FileType;
}

export function SharpApp() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [splatData, setSplatData] = useState<SplatData | null>(null);
  const { preference, cycleTheme } = useTheme();

  const handleProcessingComplete = useCallback((data: SplatData) => {
    setSplatData(data);
    setAppState("results");
  }, []);

  const { isProcessing, progress, error: _error, start, cancel } = useProcessing(
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
    if (!uploadedFile) return;
    setAppState("processing");
    start(uploadedFile.file);
  }, [start, uploadedFile]);

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
    setSplatData(null);
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
    <div className="relative h-screen bg-background">
      {/* Floating Header Islands */}
      <header className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex items-start justify-between p-4">
          {/* Left: Menu Toolbar */}
          <div className="pointer-events-auto">
            <Toolbar
              onFileSelect={handleFileSelect}
              canSave={appState === "results"}
              canExport={appState === "results"}
            />
          </div>

          {/* Center: Progress Pill (absolute centered) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-4 pointer-events-auto">
            <ProgressPill
              progress={progress}
              isVisible={appState === "processing"}
            />
          </div>

          {/* Right: Controls */}
          <div className="pointer-events-auto">
            <HeaderControls
              appState={appState}
              themePreference={preference}
              onCycleTheme={cycleTheme}
            />
          </div>
        </div>
      </header>

      {/* Canvas */}
      <main className="h-full overflow-hidden">
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

        {appState === "results" && uploadedFile && (
          <ResultsViewer
            onReset={handleReset}
            splatData={splatData}
            fileType={uploadedFile.type}
          />
        )}
      </main>
    </div>
  );
}
