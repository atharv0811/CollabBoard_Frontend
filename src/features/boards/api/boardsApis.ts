import { api } from "@/lib/axios";
import type {
  BoardResponse,
  BoardsListResponse,
  CreateBoardPayload,
  GetBoardsParams,
  RenameBoardPayload,
} from "../types/boardTypes";

export const getBoards = async (params: GetBoardsParams) => {
  const { data } = await api.get<BoardsListResponse>("/boards", { params });
  return data;
};

export const createBoard = async (payload: CreateBoardPayload) => {
  const { data } = await api.post<BoardResponse>("/boards", payload);
  return data;
};

export const renameBoard = async ({ boardId, name }: RenameBoardPayload) => {
  const { data } = await api.patch(`/boards/${boardId}/name`, { name });
  return data;
};

export const deleteBoard = async (boardId: string) => {
  const { data } = await api.delete(`/boards/${boardId}`);
  return data;
};
