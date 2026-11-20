import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBoard } from "../../api/boardsApis";
import { emptyDocument, type BoardMeta } from "../../lib/model";
import { useBoardsStore } from "../../store/boardsStore";
import { boardsQueryKey, type BoardsQueryData } from "../queries/useBoardsQuery";

export const useCreateBoardMutation = () => {
  const queryClient = useQueryClient();
  const addBoard = useBoardsStore((state) => state.addBoard);

  return useMutation({
    mutationFn: (name: string) => createBoard({ name, document: emptyDocument() }),
    onSuccess: ({ id, name, createdAt, updatedAt, document }) => {
      const board: BoardMeta = { id, name, createdAt, updatedAt };

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
    },
  });
};
