import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import WorkspacePage from "@/features/workspace/pages/WorkspacePage";
import { paths } from "@/lib/paths";

export const workspaceRoutes: RouteObject = {
  element: <ProtectedRoute />,
  children: [{ path: `${paths.workspace}/:boardId?`, element: <WorkspacePage /> }],
};
