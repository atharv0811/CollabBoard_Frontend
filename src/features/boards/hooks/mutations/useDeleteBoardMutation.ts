import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteBoard } from "../../api/boardsApis";
import { useBoardsStore } from "../../store/boardsStore";
import { boardsQueryKey, type BoardsQueryData } from "../queries/useBoardsQuery";

export const useDeleteBoardMutation = () => {
  const queryClient = useQueryClient();
  const deleteLocalBoard = useBoardsStore((state) => state.deleteBoard);

  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: (_data, boardId) => {
      deleteLocalBoard(boardId);

      queryClient.setQueryData<BoardsQueryData>(boardsQueryKey, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            boards: page.boards.filter((board) => board.id !== boardId),
            pagination: { ...page.pagination, total: Math.max(0, page.pagination.total - 1) },
          })),
        };
      });
    },
  });
};
