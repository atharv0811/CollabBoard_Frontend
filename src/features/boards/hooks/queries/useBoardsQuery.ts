import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { getBoards } from "../../api/boardsApis";
import type { BoardsListResponse } from "../../types/boardTypes";

export const BOARDS_PAGE_SIZE = 10;

export const boardsQueryKey = ["boards", "list"] as const;

export type BoardsQueryData = InfiniteData<BoardsListResponse, number>;

export const useBoardsQuery = () => {
  return useInfiniteQuery({
    queryKey: boardsQueryKey,
    queryFn: ({ pageParam }) => getBoards({ page: pageParam, limit: BOARDS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined),
  });
};
