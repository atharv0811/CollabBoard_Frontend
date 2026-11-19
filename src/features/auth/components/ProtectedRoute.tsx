import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken } from "@/features/auth/lib/authStorage";
import { paths } from "@/lib/paths";

export function ProtectedRoute() {
  const location = useLocation();

  if (!getToken()) {
    return <Navigate to={paths.login} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
