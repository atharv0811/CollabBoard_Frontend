import type { ComponentType } from "react";
import { paths } from "@/lib/paths";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";
import RegisterPage from "@/pages/RegisterPage";
import WorkspacePage from "@/pages/WorkspacePage";

/** URL path → page component. Paths come from lib/paths.ts. */
const routes: Record<string, ComponentType> = {
  [paths.landing]: LandingPage,
  [paths.login]: LoginPage,
  [paths.register]: RegisterPage,
  [paths.workspace]: WorkspacePage,
};

/** "/login/" → "/login", "/" stays "/" */
function normalizePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Minimal path-based routing.
 * Links are plain <a href> tags, so each click is a full page load; on load
 * we read the current URL once and render the matching page. Vite serves
 * index.html for every path, so this works for /login, /register, /board, etc.
 */
function App() {
  const Page = routes[normalizePath(window.location.pathname)] ?? NotFoundPage;
  return <Page />;
}

export default App;
