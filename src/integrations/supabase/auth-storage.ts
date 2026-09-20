export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const createMemoryStorage = (): StorageLike => {
  const memoryStore = new Map<string, string>();

  return {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, value) => {
      memoryStore.set(key, value);
    },
    removeItem: (key) => {
      memoryStore.delete(key);
    },
  };
};

export const createAuthStorage = (storage?: StorageLike | null): StorageLike => {
  if (storage) {
    return storage;
  }

  if (typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage;
  }

  return createMemoryStorage();
};
