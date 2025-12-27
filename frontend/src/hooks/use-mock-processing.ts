import { useCallback, useRef, useState } from "react";

export interface ProcessingStage {
  id: string;
  label: string;
  duration: number;
}

const STAGES: ProcessingStage[] = [
  { id: "preprocessing", label: "Preparing image...", duration: 1500 },
  { id: "inference", label: "Running neural network...", duration: 3000 },
  { id: "postprocessing", label: "Converting to 3D...", duration: 2000 },
  { id: "saving", label: "Finalizing...", duration: 500 },
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

export function useMockProcessing(onComplete: () => void) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const abortRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    cleanup();
    abortRef.current = false;
    setIsProcessing(true);
    startTimeRef.current = Date.now();

    let currentStageIndex = 0;
    let stageElapsed = 0;
    const tickInterval = 50; // Update every 50ms for smooth progress

    intervalRef.current = setInterval(() => {
      if (abortRef.current) {
        cleanup();
        setIsProcessing(false);
        setProgress(null);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      stageElapsed += tickInterval;

      const currentStage = STAGES[currentStageIndex];

      // Check if current stage is complete
      if (stageElapsed >= currentStage.duration) {
        currentStageIndex++;
        stageElapsed = 0;

        // Check if all stages complete
        if (currentStageIndex >= STAGES.length) {
          cleanup();
          setIsProcessing(false);
          setProgress(null);
          onComplete();
          return;
        }
      }

      const stage = STAGES[currentStageIndex];
      const stageProgress = Math.min((stageElapsed / stage.duration) * 100, 100);

      // Calculate overall progress
      let completedDuration = 0;
      for (let i = 0; i < currentStageIndex; i++) {
        completedDuration += STAGES[i].duration;
      }
      completedDuration += stageElapsed;
      const overallProgress = Math.min(
        (completedDuration / TOTAL_DURATION) * 100,
        100
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
  }, [cleanup, onComplete]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    cleanup();
    setIsProcessing(false);
    setProgress(null);
  }, [cleanup]);

  return {
    isProcessing,
    progress,
    start,
    cancel,
    stages: STAGES,
  };
}
