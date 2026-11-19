import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { paths } from "@/lib/paths";
import { clearSession } from "../lib/authStorage";

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return () => {
    clearSession();
    queryClient.clear();
    toast.success("You've been logged out.");
    navigate(paths.login, { replace: true });
  };
}
