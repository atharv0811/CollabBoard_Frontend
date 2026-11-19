import { useMutation } from "@tanstack/react-query";
import type { LoginPayload } from "../types/loginTypes";
import { loginUser } from "../api/loginUser";
import { saveSession } from "../lib/authStorage";

export const useLoginUserMutation = () => {
  return useMutation({
    mutationFn: (payload: LoginPayload) => loginUser(payload),
    onSuccess: (data) => saveSession(data),
  });
};
