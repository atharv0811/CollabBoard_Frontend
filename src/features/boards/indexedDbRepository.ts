import {
  BOARD_SCHEMA_VERSION,
  type BoardDocument,
  type BoardMeta,
} from "./model.ts";
import {
  BoardNotFoundError,
  BoardUnreadableError,
  describeError,
  StorageUnavailableError,
  type BoardList,
  type BoardRepository,
  type UnreadableBoard,
} from "./repository.ts";
import { parseBoardDocument, parseBoardMeta } from "./validation.ts";

export const DATABASE_NAME = "collabboard";
const DATABASE_VERSION = 1;
const BOARDS = "boards";
const DOCUMENTS = "documents";
const SETTINGS = "settings";
const ACTIVE_BOARD_KEY = "activeBoardId";

interface StoredMeta extends BoardMeta {
  schemaVersion: number;
}

interface StoredDocument extends BoardDocument {
  id: string;
  schemaVersion: number;
}

interface StoredSetting {
  key: string;
  value: string;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name, DATABASE_VERSION);
    } catch (error) {
      reject(
        new StorageUnavailableError(
          `Storage is unavailable: ${describeError(error)}`,
          { cause: error },
        ),
      );
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOARDS))
        db.createObjectStore(BOARDS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DOCUMENTS))
        db.createObjectStore(DOCUMENTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS))
        db.createObjectStore(SETTINGS, { keyPath: "key" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () =>
      reject(
        new StorageUnavailableError(
          `Storage is unavailable: ${describeError(request.error)}`,
          { cause: request.error },
        ),
      );
    request.onblocked = () =>
      reject(
        new StorageUnavailableError(
          "Storage is blocked by another open CollabBoard tab.",
        ),
      );
  });
}

export function createIndexedDbBoardRepository(
  factory: IDBFactory | undefined = globalThis.indexedDB,
  name = DATABASE_NAME,
): BoardRepository {
  let databasePromise: Promise<IDBDatabase> | null = null;

  const database = () => {
    if (!factory)
      return Promise.reject(
        new StorageUnavailableError("This browser does not support IndexedDB."),
      );
    databasePromise ??= openDatabase(factory, name).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
    return databasePromise;
  };

  async function run<T>(
    stores: string[],
    mode: IDBTransactionMode,
    work: (transaction: IDBTransaction) => Promise<T> | T,
  ): Promise<T> {
    const db = await database();
    const transaction = db.transaction(stores, mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed."));
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("IndexedDB transaction was aborted."),
        );
    });
    done.catch(() => undefined);
    let result: T;
    try {
      result = await work(transaction);
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        void 0;
      }
      await done.catch(() => undefined);
      throw error;
    }
    await done;
    return result;
  }

  const metaRecord = (meta: BoardMeta): StoredMeta => ({
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    schemaVersion: BOARD_SCHEMA_VERSION,
  });

  const documentRecord = (
    id: string,
    document: BoardDocument,
  ): StoredDocument => ({
    id,
    schemaVersion: BOARD_SCHEMA_VERSION,
    elements: document.elements,
    viewport: document.viewport,
  });

  async function existingMeta(
    transaction: IDBTransaction,
    id: string,
  ): Promise<StoredMeta> {
    const meta = await requestToPromise<StoredMeta | undefined>(
      transaction.objectStore(BOARDS).get(id),
    );
    if (!meta) throw new BoardNotFoundError(id);
    return meta;
  }

  return {
    listBoards: () =>
      run([BOARDS], "readonly", async (transaction): Promise<BoardList> => {
        const records = await requestToPromise<unknown[]>(
          transaction.objectStore(BOARDS).getAll(),
        );
        const boards: BoardMeta[] = [];
        const unreadable: UnreadableBoard[] = [];
        for (const record of records) {
          try {
            boards.push(parseBoardMeta(record));
          } catch (error) {
            const raw = record as Partial<StoredMeta> | null;
            if (typeof raw?.id !== "string") continue;
            unreadable.push({
              id: raw.id,
              name: typeof raw.name === "string" ? raw.name : null,
              reason: describeError(error),
            });
          }
        }
        return { boards, unreadable };
      }),

    loadDocument: (id) =>
      run([BOARDS, DOCUMENTS], "readonly", async (transaction) => {
        await existingMeta(transaction, id);
        const record = await requestToPromise<unknown>(
          transaction.objectStore(DOCUMENTS).get(id),
        );
        if (record === undefined)
          throw new BoardUnreadableError(id, "The board's content is missing.");
        try {
          return parseBoardDocument(record);
        } catch (error) {
          throw new BoardUnreadableError(id, describeError(error));
        }
      }),

    createBoard: (board) =>
      run([BOARDS, DOCUMENTS], "readwrite", async (transaction) => {
        await requestToPromise(
          transaction.objectStore(BOARDS).add(metaRecord(board)),
        );
        await requestToPromise(
          transaction
            .objectStore(DOCUMENTS)
            .add(documentRecord(board.id, board)),
        );
      }),

    saveDocument: (id, document, updatedAt) =>
      run([BOARDS, DOCUMENTS], "readwrite", async (transaction) => {
        const meta = await existingMeta(transaction, id);
        await requestToPromise(
          transaction.objectStore(DOCUMENTS).put(documentRecord(id, document)),
        );
        await requestToPromise(
          transaction.objectStore(BOARDS).put({ ...meta, updatedAt }),
        );
      }),

    renameBoard: (id, name, updatedAt) =>
      run([BOARDS], "readwrite", async (transaction) => {
        const meta = await existingMeta(transaction, id);
        await requestToPromise(
          transaction.objectStore(BOARDS).put({ ...meta, name, updatedAt }),
        );
      }),

    deleteBoard: (id) =>
      run([BOARDS, DOCUMENTS], "readwrite", async (transaction) => {
        await requestToPromise(transaction.objectStore(BOARDS).delete(id));
        await requestToPromise(transaction.objectStore(DOCUMENTS).delete(id));
      }),

    getActiveBoardId: () =>
      run([SETTINGS], "readonly", async (transaction) => {
        const setting = await requestToPromise<StoredSetting | undefined>(
          transaction.objectStore(SETTINGS).get(ACTIVE_BOARD_KEY),
        );
        return typeof setting?.value === "string" ? setting.value : null;
      }),

    setActiveBoardId: (id) =>
      run([SETTINGS], "readwrite", async (transaction) => {
        await requestToPromise(
          transaction
            .objectStore(SETTINGS)
            .put({ key: ACTIVE_BOARD_KEY, value: id }),
        );
      }),
  };
}
