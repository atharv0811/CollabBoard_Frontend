import { Outlet } from "react-router-dom";
import { Footer } from "@/features/landing/components/Footer";
import { MarketingNavbar } from "@/features/landing/components/MarketingNavbar";

export function MarketingLayout() {
  return (
    <div className="min-h-svh bg-background">
      <MarketingNavbar />
      <Outlet />
      <Footer />
    </div>
  );
}
