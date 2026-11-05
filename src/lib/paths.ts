/**
 * Central list of URLs used by links in the UI.
 * These are plain hrefs only — wire them to your router later.
 */
export const paths = {
  landing: "/",
  login: "/login",
  register: "/register",
  workspace: "/board",
  forgotPassword: "/forgot-password",
  terms: "/terms",
  privacy: "/privacy",
} as const;
