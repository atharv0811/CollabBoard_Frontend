import axios from "axios";
import { clearSession, getToken } from "@/features/auth/lib/authStorage";
import { navigateTo } from "@/lib/navigation";
import { paths } from "@/lib/paths";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {},
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      navigateTo(paths.login, { replace: true });
    }

    return Promise.reject(error);
  },
);
