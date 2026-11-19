import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

interface UserMenuProps {
  children: ReactNode;
  triggerClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export function UserMenu({ children, triggerClassName, side = "bottom", align = "end" }: UserMenuProps) {
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <Menu.Root>
      <Menu.Trigger aria-label={`Account: ${user?.name ?? "Account"}`} className={triggerClassName}>
        {children}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side={side} align={align} sideOffset={8} className="z-(--z-tooltip)">
          <Menu.Popup className="w-60 surface-floating p-1.5 outline-none">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>

            <Menu.Separator className="my-1 h-px bg-border" />

            <Menu.Item
              onClick={logout}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none",
                "data-highlighted:bg-accent",
              )}
            >
              <LogOut aria-hidden="true" className="size-4 text-muted-foreground" />
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
