import type { ComponentType } from "react";
import { paths } from "@/lib/paths";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";
import RegisterPage from "@/pages/RegisterPage";
import WorkspacePage from "@/pages/WorkspacePage";

const routes: Record<string, ComponentType> = {
  [paths.landing]: LandingPage,
  [paths.login]: LoginPage,
  [paths.register]: RegisterPage,
  [paths.workspace]: WorkspacePage,
};

function normalizePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function App() {
  const Page = routes[normalizePath(window.location.pathname)] ?? NotFoundPage;
  return <Page />;
}

export default App;
