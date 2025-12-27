import { Sun, Moon, Monitor } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getKeybindings, formatKey, type AppState } from "@/lib/keybindings";
import type { ThemePreference } from "@/hooks/use-theme";

interface HeaderControlsProps {
  appState: AppState;
  themePreference: ThemePreference;
  onCycleTheme: () => void;
}

const themeLabels: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const nextTheme: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function HeaderControls({
  appState,
  themePreference,
  onCycleTheme,
}: HeaderControlsProps) {
  const keybindings = getKeybindings(appState);

  const ThemeIcon = {
    system: Monitor,
    light: Sun,
    dark: Moon,
  }[themePreference];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col items-end gap-6">
        {/* Theme toggle pill */}
        <div className="flex items-center bg-card/80 backdrop-blur-sm rounded-full p-1 shadow-md ring-1 ring-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onCycleTheme}
                aria-label={`Theme: ${themeLabels[themePreference]}. Click for ${themeLabels[nextTheme[themePreference]]}`}
              >
                <ThemeIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {themeLabels[themePreference]} theme (click for{" "}
                {themeLabels[nextTheme[themePreference]].toLowerCase()})
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Keybinding hints - stacked vertically */}
        {keybindings.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            {keybindings.map((kb) => (
              <span
                key={kb.action}
                className="text-xs text-muted-foreground/60 dark:text-muted-foreground/40"
              >
                {kb.label} <span className="font-mono ml-3">{formatKey(kb.key)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
