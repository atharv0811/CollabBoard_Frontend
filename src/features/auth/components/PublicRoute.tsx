import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "@/features/auth/lib/authStorage";
import { paths } from "@/lib/paths";

export function PublicRoute() {
  if (getToken()) {
    return <Navigate to={paths.workspace} replace />;
  }

  return <Outlet />;
}
