import type { RouteObject } from "react-router-dom";
import { MarketingLayout } from "@/features/landing/layouts/MarketingLayout";
import LandingPage from "@/features/landing/pages/LandingPage";
import { paths } from "@/lib/paths";

export const landingRoutes: RouteObject = {
  element: <MarketingLayout />,
  children: [{ path: paths.landing, element: <LandingPage /> }],
};
