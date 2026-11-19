import type { RouteObject } from "react-router-dom";
import { PublicRoute } from "@/features/auth/components/PublicRoute";
import { AuthLayout, type AuthRouteHandle } from "@/features/auth/layouts/AuthLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import RegisterPage from "@/features/auth/pages/RegisterPage";
import { paths } from "@/lib/paths";

const loginHandle: AuthRouteHandle = {
  authPanel: {
    title: "Pick up right where your team left off.",
    description: "Every board, sketch and comment is waiting for you — exactly as everyone left it.",
  },
};

const registerHandle: AuthRouteHandle = {
  authPanel: {
    title: "Where scattered ideas become shared plans.",
    description: "Create boards, invite your team and think out loud together on one endless canvas.",
  },
};

export const authRoutes: RouteObject = {
  element: <PublicRoute />,
  children: [
    {
      element: <AuthLayout />,
      children: [
        { path: paths.login, element: <LoginPage />, handle: loginHandle },
        { path: paths.register, element: <RegisterPage />, handle: registerHandle },
      ],
    },
  ],
};
