/**
 * 3D Gaussian Splatting Viewer component.
 * Renders PLY point clouds using WebGPU.
 */

import { useEffect, useRef } from "react";
import { useGaussianRenderer } from "@/hooks/use-gaussian-renderer";
import { useWebGPUSupport } from "@/hooks/use-webgpu-support";
import { WebGPUFallback } from "./webgpu-fallback";
import { cn } from "@/lib/utils";
import type { SplatData, RendererStats } from "@/lib/webgpu";

interface GaussianViewerProps {
  /** Splat data to render */
  splatData: SplatData | null;
  /** Additional CSS classes */
  className?: string;
  /** Callback when stats update */
  onStatsUpdate?: (stats: RendererStats) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
  /** Show loading state when waiting for data */
  showLoading?: boolean;
}

export function GaussianViewer({
  splatData,
  className,
  onStatsUpdate,
  onError,
  showLoading = true,
}: GaussianViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isSupported, isChecking, error: supportError } = useWebGPUSupport();

  const {
    canvasRef,
    isReady,
    hasData,
    error: rendererError,
    loadSplats,
  } = useGaussianRenderer({
    onStatsUpdate,
    onError,
  });

  // Handle canvas resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set display size
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Set actual size (will be handled by renderer, but good to initialize)
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });

    observer.observe(container);
    updateCanvasSize();

    return () => observer.disconnect();
  }, [canvasRef]);

  // Load splat data when available
  useEffect(() => {
    if (isReady && splatData) {
      loadSplats(splatData);
    }
  }, [isReady, splatData, loadSplats]);

  // Show checking state
  if (isChecking) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="text-sm text-muted-foreground">Checking WebGPU support...</div>
      </div>
    );
  }

  // Show fallback if WebGPU not supported
  if (!isSupported) {
    return <WebGPUFallback error={supportError} className={className} />;
  }

  // Show error state
  if (rendererError) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="text-sm text-destructive">
          Failed to initialize renderer: {rendererError.message}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        tabIndex={0}
      />

      {/* Loading overlay */}
      {showLoading && isReady && !hasData && !splatData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">Waiting for 3D data...</div>
        </div>
      )}

      {/* Loading data indicator */}
      {showLoading && isReady && splatData && !hasData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">Loading 3D scene...</div>
        </div>
      )}
    </div>
  );
}
