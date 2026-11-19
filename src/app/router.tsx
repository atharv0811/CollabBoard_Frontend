import { createBrowserRouter } from "react-router-dom";
import { authRoutes } from "@/features/auth/routes";
import { landingRoutes } from "@/features/landing/routes";
import { notFoundRoutes } from "@/features/not-found/routes";
import { workspaceRoutes } from "@/features/workspace/routes";
import { setNavigator } from "@/lib/navigation";
import { RootLayout } from "./RootLayout";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [landingRoutes, authRoutes, workspaceRoutes, notFoundRoutes],
  },
]);

setNavigator((to, options) => router.navigate(to, options));
