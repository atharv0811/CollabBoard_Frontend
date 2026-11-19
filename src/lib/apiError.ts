import axios from "axios";

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Can't reach the server. Check your connection and try again.";

    const data: unknown = error.response.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      const { message, error: errorText } = data as { message?: unknown; error?: unknown };
      if (typeof message === "string" && message.trim()) return message;
      if (Array.isArray(message) && typeof message[0] === "string") return message[0];
      if (typeof errorText === "string" && errorText.trim()) return errorText;
    }
  }
  return fallback;
}
