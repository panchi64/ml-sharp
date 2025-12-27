/**
 * Hook to check WebGPU support.
 */

import { useState, useEffect } from "react";
import { checkWebGPUSupport } from "@/lib/webgpu";

export interface WebGPUSupportState {
  /** Whether WebGPU is supported */
  isSupported: boolean;
  /** Whether check is still in progress */
  isChecking: boolean;
  /** Error message if not supported */
  error?: string;
}

/**
 * Check if WebGPU is supported in the current browser.
 */
export function useWebGPUSupport(): WebGPUSupportState {
  const [state, setState] = useState<WebGPUSupportState>({
    isSupported: false,
    isChecking: true,
  });

  useEffect(() => {
    let mounted = true;

    async function check() {
      const result = await checkWebGPUSupport();

      if (mounted) {
        setState({
          isSupported: result.supported,
          isChecking: false,
          error: result.reason,
        });
      }
    }

    check();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
