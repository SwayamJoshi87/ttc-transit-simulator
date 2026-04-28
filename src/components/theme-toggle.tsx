"use client";

import type { MouseEvent, ComponentType } from "react";
import { Monitor, Moon, Sun, Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import type { Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const OPTIONS: {
  theme: Theme;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { theme: "light", label: "Light", description: "Always light", icon: Sun },
  { theme: "dark", label: "Dark", description: "Always dark", icon: Moon },
  {
    theme: "system",
    label: "System",
    description: "Follows OS setting",
    icon: Monitor,
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const pick = (nextTheme: Theme, e: MouseEvent) => {
    setTheme(nextTheme, { x: e.clientX, y: e.clientY });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52 p-2">
        <DropdownMenuLabel className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mb-2" />

        <div className="flex flex-col gap-0.5">
          {OPTIONS.map(({ theme: t, label, description, icon: Icon }) => {
            const active = theme === t;
            return (
              <DropdownMenuItem
                key={t}
                onClick={(e) => pick(t, e)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                  active && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "text-sm leading-tight",
                      active ? "font-semibold" : "font-medium",
                    )}
                  >
                    {label}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {description}
                  </span>
                </span>

                <Check
                  className={cn(
                    "ml-auto h-3.5 w-3.5 shrink-0 text-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
