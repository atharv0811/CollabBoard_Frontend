import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getBoard } from "../../api/boardsApis";

export const boardQueryKey = (boardId: string) => ["boards", "detail", boardId] as const;

const isClientError = (error: unknown) => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return status !== undefined && status >= 400 && status < 500;
};

export const useBoardQuery = (boardId: string | undefined) => {
  return useQuery({
    queryKey: boardQueryKey(boardId ?? ""),
    queryFn: () => getBoard(boardId ?? ""),
    enabled: Boolean(boardId),
    retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
  });
};
