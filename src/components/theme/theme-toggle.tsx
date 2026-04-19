"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
      {!hydrated ? (
        <>
          <Sun className="h-4 w-4" />
          Theme
        </>
      ) : theme === "light" ? (
        <>
          <Moon className="h-4 w-4" />
          Black
        </>
      ) : (
        <>
          <Sun className="h-4 w-4" />
          Light
        </>
      )}
    </Button>
  );
}
