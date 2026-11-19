import { Outlet, ScrollRestoration } from "react-router-dom";

export function RootLayout() {
  return (
    <>
      <Outlet />
      {/* Client-side navigation keeps scroll position by default; reset it like a full page load would. */}
      <ScrollRestoration />
    </>
  );
}
