/**
 * Fallback UI when WebGPU is not available.
 */

import { Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface WebGPUFallbackProps {
  error?: string;
  className?: string;
}

export function WebGPUFallback({ error, className }: WebGPUFallbackProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-8 text-center",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Warning className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">WebGPU Not Available</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your browser doesn't support WebGPU, which is required for the 3D viewer.
        </p>
        {error && (
          <p className="max-w-sm text-xs text-muted-foreground/70">{error}</p>
        )}
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p>Try one of these browsers:</p>
        <ul className="list-disc list-inside">
          <li>Chrome 113+ (recommended)</li>
          <li>Edge 113+</li>
          <li>Firefox Nightly (with flag)</li>
        </ul>
      </div>
    </div>
  );
}
