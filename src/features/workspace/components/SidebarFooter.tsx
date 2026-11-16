import { ChevronsUpDown, Languages, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { sampleUser } from "../data/collaborators";

const themeOptions: { id: ThemePreference; label: string; icon: LucideIcon }[] = [
  { id: "light", label: "Light theme", icon: Sun },
  { id: "dark", label: "Dark theme", icon: Moon },
  { id: "system", label: "Use system theme", icon: Monitor },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="group" aria-label="Theme" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-secondary p-0.5">
      {themeOptions.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={id === theme}
          onClick={() => setTheme(id)}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150",
            "hover:text-foreground aria-pressed:bg-card aria-pressed:text-selected-foreground aria-pressed:shadow-xs",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

function LanguagePreview() {
  return (
    <button
      type="button"
      aria-label="Language: English"
      className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[0.8125rem] text-foreground/85 transition-colors duration-150 hover:border-border-strong hover:bg-accent"
    >
      <Languages aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="flex-1 text-left">English</span>
      <ChevronsUpDown aria-hidden="true" className="size-3.5 text-subtle-foreground" />
    </button>
  );
}

function UserProfile() {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-tool p-1.5 text-left transition-colors duration-150 hover:bg-accent"
    >
      <Avatar name={sampleUser.name} tone={sampleUser.tone} size="md" online />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-foreground">{sampleUser.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{sampleUser.email}</span>
      </span>
      <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 text-subtle-foreground" />
    </button>
  );
}

export function SidebarFooter() {
  return (
    <div className="flex flex-col gap-2 px-1.5">
      <div className="flex items-center gap-2 px-1">
        <ThemeToggle />
        <LanguagePreview />
      </div>
      <div className="border-t border-border pt-1.5">
        <UserProfile />
      </div>
    </div>
  );
}
