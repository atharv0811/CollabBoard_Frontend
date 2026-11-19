import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";
import { Logo } from "@/components/common/Logo";
import { buttonVariants } from "@/components/ui/button";
import { paths } from "@/lib/paths";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link to={paths.landing} aria-label="CollabBoard home" className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link to={paths.login} className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
            Log in
          </Link>
          <Link to={paths.register} className={buttonVariants()}>
            Get started
          </Link>
          <IconButton icon={Menu} label="Open navigation" className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
