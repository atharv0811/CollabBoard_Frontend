import { api } from "@/lib/axios";
import type { LoginPayload, LoginResponse } from "../types/loginTypes";

export const loginUser = async (payload: LoginPayload) => {
  const { data } = await api.post<LoginResponse>("/auth/login", payload);
  return data;
};
