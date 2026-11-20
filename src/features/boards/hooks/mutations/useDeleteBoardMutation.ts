import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { deleteBoard } from "../../api/boardsApis";
import { useBoardsStore } from "../../store/boardsStore";
import { boardsQueryKey, type BoardsQueryData } from "../queries/useBoardsQuery";

export const useDeleteBoardMutation = () => {
  const queryClient = useQueryClient();
  const deleteLocalBoard = useBoardsStore((state) => state.deleteBoard);

  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: (data, boardId) => {
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
      toast.success(data.message, { id: "delete-board" });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't delete the board. Please try again."), { id: "delete-board" });
    },
  });
};
