import { Sun, Moon, Monitor } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center gap-2">
        {/* Keybinding hints */}
        <div className="flex items-center gap-1.5">
          {keybindings.map((kb) => (
            <Badge
              key={kb.action}
              variant="secondary"
              className="text-xs font-mono px-2 py-0.5"
            >
              {formatKey(kb.key)} {kb.label}
            </Badge>
          ))}
        </div>

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
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
    </TooltipProvider>
  );
}
