import { api } from "@/lib/axios";
import type {
  BoardResponse,
  BoardsListResponse,
  CreateBoardPayload,
  DeleteBoardResponse,
  GetBoardsParams,
  RenameBoardPayload,
  UpdateBoardDocumentPayload,
} from "../types/boardTypes";

export const getBoards = async (params: GetBoardsParams) => {
  const { data } = await api.get<BoardsListResponse>("/boards", { params });
  return data;
};

export const getBoard = async (boardId: string) => {
  const { data } = await api.get<BoardResponse>(`/boards/${boardId}`);
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

export const updateBoardDocument = async ({ boardId, document }: UpdateBoardDocumentPayload) => {
  const { data } = await api.patch(`/boards/${boardId}/document`, { document });
  return data;
};

export const deleteBoard = async (boardId: string) => {
  const { data } = await api.delete<DeleteBoardResponse>(`/boards/${boardId}`);
  return data;
};
