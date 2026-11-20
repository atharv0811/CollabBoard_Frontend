import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "@/lib/apiError";
import { paths } from "@/lib/paths";
import { createBoard } from "../../api/boardsApis";
import { emptyDocument, type BoardMeta } from "../../lib/model";
import { useBoardsStore } from "../../store/boardsStore";
import { boardQueryKey } from "../queries/useBoardQuery";
import { boardsQueryKey, type BoardsQueryData } from "../queries/useBoardsQuery";

interface CreateBoardMutationOptions {
  notifyOnSuccess?: boolean;
}

export const useCreateBoardMutation = ({ notifyOnSuccess = true }: CreateBoardMutationOptions = {}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const addBoard = useBoardsStore((state) => state.addBoard);

  return useMutation({
    mutationFn: (name: string) => createBoard({ name, document: emptyDocument() }),
    onSuccess: (created) => {
      const { id, name, createdAt, updatedAt, document } = created;
      const board: BoardMeta = { id, name, createdAt, updatedAt };
      queryClient.setQueryData(boardQueryKey(id), created);

      queryClient.setQueryData<BoardsQueryData>(boardsQueryKey, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page, index) => ({
            boards: index === 0 ? [board, ...page.boards] : page.boards,
            pagination: { ...page.pagination, total: page.pagination.total + 1 },
          })),
        };
      });

      addBoard(board, document ?? emptyDocument());
      navigate(paths.board(id));
      if (notifyOnSuccess) toast.success(`Created “${name}”.`, { id: "create-board" });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't create the board. Please try again."), { id: "create-board" });
    },
  });
};
