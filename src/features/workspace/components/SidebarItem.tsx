import { cn } from "@/lib/utils";
import type { MenuItem } from "../data/menuItems";

interface SidebarItemProps {
  item: MenuItem;
  active?: boolean;
  onClick?: () => void;
}

export function SidebarItem({ item, active = false, onClick }: SidebarItemProps) {
  const Icon = item.icon;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group/item flex h-7.5 w-full items-center gap-2.5 rounded-tool px-2.5 text-left text-[0.8125rem] text-foreground/85 transition-colors duration-150",
          "hover:bg-accent hover:text-foreground",
          "aria-[current=page]:bg-selected aria-[current=page]:font-medium aria-[current=page]:text-selected-foreground",
        )}
      >
        <Icon
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground group-aria-[current=page]/item:text-selected-foreground"
        />
        <span className="flex-1 truncate">{item.label}</span>
        {item.shortcut && <span className="text-[0.6875rem] text-subtle-foreground">{item.shortcut}</span>}
        {item.count !== undefined && (
          <span className="min-w-5 rounded-full bg-secondary px-1.5 text-center text-[0.6875rem] leading-5 font-medium text-muted-foreground group-aria-[current=page]/item:bg-card group-aria-[current=page]/item:text-selected-foreground">
            {item.count}
          </span>
        )}
      </button>
    </li>
  );
}
