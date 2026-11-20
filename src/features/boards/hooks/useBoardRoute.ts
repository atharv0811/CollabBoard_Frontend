import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { paths } from "@/lib/paths";
import { useBoardsStore } from "../store/boardsStore";
import { useBoardQuery } from "./queries/useBoardQuery";
import { useBoardsQuery } from "./queries/useBoardsQuery";

export function useBoardRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const boards = useBoardsStore((state) => state.boards);
  const activeBoardId = useBoardsStore((state) => state.activeBoardId);
  const openBoard = useBoardsStore((state) => state.openBoard);
  const boardsLoaded = useBoardsQuery().isSuccess;
  const boardQuery = useBoardQuery(boardId);

  useEffect(() => {
    if (boardId || !boardsLoaded) return;
    const target = boards.find((board) => board.id === activeBoardId) ?? boards[0];
    if (target) navigate(paths.board(target.id), { replace: true });
  }, [boardId, boardsLoaded, boards, activeBoardId, navigate]);

  useEffect(() => {
    if (boardQuery.data) openBoard(boardQuery.data.id, boardQuery.data.document);
  }, [boardQuery.data, openBoard]);

  useEffect(() => {
    if (!boardQuery.isError) return;
    toast.error(getApiErrorMessage(boardQuery.error, "Couldn't open this board."), { id: "load-board-error" });
    navigate(paths.workspace, { replace: true });
  }, [boardQuery.isError, boardQuery.error, navigate]);
}
