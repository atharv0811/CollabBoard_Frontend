export const paths = {
  landing: "/",
  login: "/login",
  register: "/register",
  workspace: "/board",
  board: (boardId: string) => `/board/${boardId}`,
  forgotPassword: "/forgot-password",
  terms: "/terms",
  privacy: "/privacy",
} as const;
