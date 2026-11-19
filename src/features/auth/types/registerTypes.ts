import type { AuthUser } from "./loginTypes";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export type RegisterResponse = AuthUser;
