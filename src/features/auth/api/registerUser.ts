import { api } from "@/lib/axios";
import type { RegisterPayload, RegisterResponse } from "../types/registerTypes";

export const registerUser = async (payload: RegisterPayload) => {
  const { data } = await api.post<RegisterResponse>("/auth/register", payload);
  return data;
};
