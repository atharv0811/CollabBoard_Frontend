import { api } from "@/lib/axios";
import type { BoardResponse, BoardsListResponse, CreateBoardPayload, GetBoardsParams } from "../types/boardTypes";

export const getBoards = async (params: GetBoardsParams) => {
  const { data } = await api.get<BoardsListResponse>("/boards", { params });
  return data;
};

export const createBoard = async (payload: CreateBoardPayload) => {
  const { data } = await api.post<BoardResponse>("/boards", payload);
  return data;
};
