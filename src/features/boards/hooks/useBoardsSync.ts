import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { DEFAULT_BOARD_NAME } from "../lib/model";
import { useBoardsStore } from "../store/boardsStore";
import { useCreateBoardMutation } from "./mutations/useCreateBoardMutation";
import { useBoardsQuery } from "./queries/useBoardsQuery";

export function useBoardsSync() {
  const query = useBoardsQuery();
  const syncBoards = useBoardsStore((state) => state.syncBoards);
  const { mutate: createBoard } = useCreateBoardMutation({ notifyOnSuccess: false });
  const autoCreated = useRef(false);

  const boards = useMemo(() => query.data?.pages.flatMap((page) => page.boards) ?? [], [query.data]);
  const total = query.data?.pages[0]?.pagination.total;

  useEffect(() => {
    if (query.isSuccess) syncBoards(boards);
  }, [query.isSuccess, boards, syncBoards]);

  useEffect(() => {
    if (total !== undefined && total > 0) autoCreated.current = false;
    if (!query.isSuccess || total !== 0 || autoCreated.current) return;
    autoCreated.current = true;
    createBoard(DEFAULT_BOARD_NAME);
  }, [query.isSuccess, total, createBoard]);

  useEffect(() => {
    if (query.isError) {
      toast.error(getApiErrorMessage(query.error, "Couldn't load your boards."), { id: "load-boards-error" });
    }
  }, [query.isError, query.error]);
}
