import { useCallback, useRef, useState } from "react";
import type { SplatData } from "@/lib/webgpu";
import { parsePlyFile } from "@/lib/webgpu";

export interface ProcessingStage {
  id: string;
  label: string;
  duration: number;
}

const STAGES: ProcessingStage[] = [
  { id: "uploading", label: "Uploading image...", duration: 500 },
  { id: "loading", label: "Loading model...", duration: 2000 },
  { id: "inference", label: "Running neural network...", duration: 4000 },
  { id: "postprocessing", label: "Converting to 3D...", duration: 1500 },
  { id: "finalizing", label: "Finalizing...", duration: 500 },
];

const TOTAL_DURATION = STAGES.reduce((sum, stage) => sum + stage.duration, 0);

export interface ProcessingProgress {
  stageIndex: number;
  stageId: string;
  stageLabel: string;
  stageProgress: number;
  overallProgress: number;
  elapsedTime: number;
}

const API_BASE = import.meta.env.DEV ? "http://localhost:8765" : "";

export function useProcessing(onComplete: (data: SplatData) => void) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const responseReceivedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    abortControllerRef.current = null;
    responseReceivedRef.current = false;
  }, []);

  const start = useCallback(
    async (file: File) => {
      cleanup();
      setIsProcessing(true);
      setError(null);
      startTimeRef.current = Date.now();
      responseReceivedRef.current = false;

      // Start progress simulation
      let currentStageIndex = 0;
      let stageElapsed = 0;
      const tickInterval = 50;

      intervalRef.current = setInterval(() => {
        if (responseReceivedRef.current) {
          // Response received, finish quickly
          setProgress({
            stageIndex: STAGES.length - 1,
            stageId: "finalizing",
            stageLabel: "Finalizing...",
            stageProgress: 100,
            overallProgress: 100,
            elapsedTime: Date.now() - startTimeRef.current,
          });
          return;
        }

        const elapsed = Date.now() - startTimeRef.current;
        stageElapsed += tickInterval;

        const currentStage = STAGES[currentStageIndex];

        // Progress through stages, but pause at inference if we haven't received response
        if (stageElapsed >= currentStage.duration) {
          if (currentStageIndex < STAGES.length - 2) {
            // Can advance (but not past inference until response)
            currentStageIndex++;
            stageElapsed = 0;
          } else if (currentStageIndex === STAGES.length - 2) {
            // At inference stage - loop within 80-95% until response
            stageElapsed = currentStage.duration * 0.8;
          }
        }

        const stage = STAGES[currentStageIndex];
        const stageProgress = Math.min(
          (stageElapsed / stage.duration) * 100,
          currentStageIndex === STAGES.length - 2 ? 95 : 100
        );

        // Calculate overall progress
        let completedDuration = 0;
        for (let i = 0; i < currentStageIndex; i++) {
          completedDuration += STAGES[i].duration;
        }
        completedDuration += stageElapsed;
        const overallProgress = Math.min(
          (completedDuration / TOTAL_DURATION) * 100,
          95 // Cap at 95% until response
        );

        setProgress({
          stageIndex: currentStageIndex,
          stageId: stage.id,
          stageLabel: stage.label,
          stageProgress,
          overallProgress,
          elapsedTime: elapsed,
        });
      }, tickInterval);

      // Make the actual API call
      try {
        abortControllerRef.current = new AbortController();

        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`${API_BASE}/api/predict`, {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Server error: ${response.statusText}`
          );
        }

        // Get the PLY file as binary
        const plyBuffer = await response.arrayBuffer();

        // Signal that response was received
        responseReceivedRef.current = true;

        // Parse the PLY file using existing parser
        const splatData = await parsePlyFile(plyBuffer);

        // Small delay to show finalizing stage
        await new Promise((resolve) => setTimeout(resolve, 300));

        cleanup();
        setIsProcessing(false);
        setProgress(null);
        onComplete(splatData);
      } catch (err) {
        cleanup();
        setIsProcessing(false);
        setProgress(null);

        if (err instanceof Error) {
          if (err.name === "AbortError") {
            // User cancelled, not an error
            return;
          }
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      }
    },
    [cleanup, onComplete]
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    cleanup();
    setIsProcessing(false);
    setProgress(null);
    setError(null);
  }, [cleanup]);

  return {
    isProcessing,
    progress,
    error,
    start,
    cancel,
    stages: STAGES,
  };
}
