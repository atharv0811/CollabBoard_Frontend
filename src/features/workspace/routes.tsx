import type { RouteObject } from "react-router-dom";
import WorkspacePage from "@/features/workspace/pages/WorkspacePage";
import { paths } from "@/lib/paths";

export const workspaceRoutes: RouteObject = {
  path: paths.workspace,
  element: <WorkspacePage />,
};
