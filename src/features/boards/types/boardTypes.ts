import type { BoardDocument, BoardMeta } from "../lib/model";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface GetBoardsParams {
  page: number;
  limit: number;
}

export interface BoardsListResponse {
  boards: BoardMeta[];
  pagination: Pagination;
}

export interface CreateBoardPayload {
  name: string;
  document: BoardDocument;
}

export interface RenameBoardPayload {
  boardId: string;
  name: string;
}

export interface UpdateBoardDocumentPayload {
  boardId: string;
  document: BoardDocument;
}

export interface DeleteBoardResponse {
  message: string;
}

export interface BoardResponse extends BoardMeta {
  document: BoardDocument;
  ownerId: string;
}
