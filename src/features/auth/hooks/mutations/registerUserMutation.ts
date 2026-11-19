import { useMutation } from "@tanstack/react-query";
import type { RegisterPayload } from "../../types/registerTypes";
import { registerUser } from "../../api/registerUser";

export const useRegisterUserMutation = () => {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => registerUser(payload),
  });
};
