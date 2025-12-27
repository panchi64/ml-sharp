/**
 * React hook for managing the Gaussian Splat Renderer lifecycle.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { GaussianSplatRenderer, type RendererStats, type SplatData } from "@/lib/webgpu";

export interface UseGaussianRendererOptions {
  /** Callback when stats update */
  onStatsUpdate?: (stats: RendererStats) => void;
  /** Callback when initialization fails */
  onError?: (error: Error) => void;
}

export interface UseGaussianRendererResult {
  /** Ref callback to attach to canvas element */
  canvasRef: (node: HTMLCanvasElement | null) => void;
  /** Whether the renderer is initialized */
  isReady: boolean;
  /** Whether splat data is loaded */
  hasData: boolean;
  /** Current error state */
  error: Error | null;
  /** Load splat data */
  loadSplats: (data: SplatData) => void;
  /** Reset camera to fit scene */
  resetCamera: () => void;
  /** Current renderer stats */
  stats: RendererStats | null;
}

/**
 * Hook to manage Gaussian Splat Renderer lifecycle.
 *
 * @example
 * ```tsx
 * function Viewer({ splatData }) {
 *   const { canvasRef, isReady, loadSplats, error } = useGaussianRenderer();
 *
 *   useEffect(() => {
 *     if (isReady && splatData) {
 *       loadSplats(splatData);
 *     }
 *   }, [isReady, splatData, loadSplats]);
 *
 *   return <canvas ref={canvasRef} />;
 * }
 * ```
 */
export function useGaussianRenderer(
  options: UseGaussianRendererOptions = {}
): UseGaussianRendererResult {
  // Use state to track canvas element so effect re-runs when canvas becomes available
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GaussianSplatRenderer | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<RendererStats | null>(null);

  // Callback ref to track when canvas element becomes available
  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    setCanvasElement(node);
  }, []);

  // Initialize renderer when canvas is available
  useEffect(() => {
    if (!canvasElement) return;

    const renderer = new GaussianSplatRenderer(canvasElement);
    rendererRef.current = renderer;

    // Set up stats callback
    renderer.setStatsCallback((newStats) => {
      setStats(newStats);
      options.onStatsUpdate?.(newStats);
    });

    // Initialize
    renderer
      .initialize()
      .then(() => {
        setIsReady(true);
        setError(null);
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
      });

    // Cleanup on unmount or when canvas changes
    return () => {
      renderer.dispose();
      rendererRef.current = null;
      setIsReady(false);
      setHasData(false);
    };
  }, [canvasElement]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load splats callback
  const loadSplats = useCallback((data: SplatData) => {
    const renderer = rendererRef.current;
    if (!renderer) {
      console.error("Renderer not available");
      return;
    }

    try {
      renderer.loadSplats(data);
      setHasData(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options.onError?.(error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset camera callback
  const resetCamera = useCallback(() => {
    rendererRef.current?.resetCamera();
  }, []);

  return {
    canvasRef,
    isReady,
    hasData,
    error,
    loadSplats,
    resetCamera,
    stats,
  };
}
