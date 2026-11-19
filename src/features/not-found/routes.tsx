import type { RouteObject } from "react-router-dom";
import NotFoundPage from "@/features/not-found/pages/NotFoundPage";

export const notFoundRoutes: RouteObject = {
  path: "*",
  element: <NotFoundPage />,
};
