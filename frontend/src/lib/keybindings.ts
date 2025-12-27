export type AppState = "idle" | "preview" | "processing" | "results";

export interface Keybinding {
  key: string;
  label: string;
  action: string;
}

const keybindingsMap: Record<AppState, Keybinding[]> = {
  idle: [{ key: "⌘O", label: "Open", action: "open" }],
  preview: [
    { key: "Enter", label: "Start", action: "start" },
    { key: "Esc", label: "Cancel", action: "cancel" },
  ],
  processing: [{ key: "Esc", label: "Cancel", action: "cancel" }],
  results: [
    { key: "⌘S", label: "Save", action: "save" },
    { key: "R", label: "Reset", action: "reset" },
  ],
};

export function getKeybindings(state: AppState): Keybinding[] {
  return keybindingsMap[state] || [];
}

// Detect if user is on Mac for displaying correct modifier key
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

// Convert ⌘ to Ctrl for non-Mac users
export function formatKey(key: string): string {
  if (isMac()) return key;
  return key.replace("⌘", "Ctrl+");
}
