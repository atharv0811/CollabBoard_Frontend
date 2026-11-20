import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "@/lib/apiError";
import { paths } from "@/lib/paths";
import { deleteBoard } from "../../api/boardsApis";
import { useBoardsStore } from "../../store/boardsStore";
import { boardQueryKey } from "../queries/useBoardQuery";
import { boardsQueryKey, type BoardsQueryData } from "../queries/useBoardsQuery";

export const useDeleteBoardMutation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const deleteLocalBoard = useBoardsStore((state) => state.deleteBoard);

  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: (data, boardId) => {
      const wasActive = useBoardsStore.getState().activeBoardId === boardId;
      deleteLocalBoard(boardId);

      queryClient.setQueryData<BoardsQueryData>(boardsQueryKey, (cached) => {
        if (!cached) return cached;
        return {
          ...cached,
          pages: cached.pages.map((page) => ({
            boards: page.boards.filter((board) => board.id !== boardId),
            pagination: { ...page.pagination, total: Math.max(0, page.pagination.total - 1) },
          })),
        };
      });
      queryClient.removeQueries({ queryKey: boardQueryKey(boardId) });

      if (wasActive) {
        const next = useBoardsStore.getState().boards[0];
        navigate(next ? paths.board(next.id) : paths.workspace, { replace: true });
      }
      toast.success(data.message, { id: "delete-board" });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't delete the board. Please try again."), { id: "delete-board" });
    },
  });
};
