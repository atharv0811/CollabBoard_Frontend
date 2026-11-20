import { create } from "zustand";
import type { SaveStatus } from "../components/SaveStatusIndicator";

interface SaveStatusStore {
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
}

export const useSaveStatusStore = create<SaveStatusStore>()((set) => ({
  status: "saved",
  setStatus: (status) => set({ status }),
}));
