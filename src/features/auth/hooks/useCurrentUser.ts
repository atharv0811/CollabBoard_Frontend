import { getStoredUser } from "../lib/authStorage";

export function useCurrentUser() {
  return getStoredUser();
}
