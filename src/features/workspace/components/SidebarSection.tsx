import type { MenuItem } from "../data/menuItems";
import { SidebarItem } from "./SidebarItem";

interface SidebarSectionProps {
  /** Visible group heading; omit for the top action list */
  title?: string;
  items: MenuItem[];
  activeId?: string;
}

export function SidebarSection({ title, items, activeId }: SidebarSectionProps) {
  const headingId = title ? `sidebar-${title.toLowerCase().replace(/\s+/g, "-")}` : undefined;

  return (
    <section aria-labelledby={headingId} className="px-1.5">
      {title && (
        <h2
          id={headingId}
          className="px-2.5 pt-0.5 pb-1 text-[0.6875rem] font-semibold tracking-wide text-subtle-foreground uppercase"
        >
          {title}
        </h2>
      )}
      <ul className="flex flex-col gap-px">
        {items.map((item) => (
          <SidebarItem key={item.id} item={item} active={item.id === activeId} />
        ))}
      </ul>
    </section>
  );
}
