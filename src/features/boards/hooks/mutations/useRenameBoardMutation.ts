import { useMutation, useQueryClient } from "@tanstack/react-query";
import { renameBoard } from "../../api/boardsApis";
import { useBoardsStore } from "../../store/boardsStore";
import type { RenameBoardPayload } from "../../types/boardTypes";
import { boardsQueryKey, type BoardsQueryData } from "../queries/useBoardsQuery";

export const useRenameBoardMutation = () => {
  const queryClient = useQueryClient();
  const renameLocalBoard = useBoardsStore((state) => state.renameBoard);

  return useMutation({
    mutationFn: (payload: RenameBoardPayload) => renameBoard(payload),
    onSuccess: (_data, { boardId, name }) => {
      renameLocalBoard(boardId, name);

      queryClient.setQueryData<BoardsQueryData>(boardsQueryKey, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            boards: page.boards.map((board) => (board.id === boardId ? { ...board, name } : board)),
          })),
        };
      });
    },
  });
};
