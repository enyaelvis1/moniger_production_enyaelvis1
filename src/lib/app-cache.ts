import type { QueryClient } from "@tanstack/react-query";

export const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  return /dynamically imported module|importing a module script failed|loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(
    message,
  );
};

export const clearBrowserAppCaches = async () => {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  const cacheNames = await window.caches.keys();
  await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
};

export const clearAppCache = async (queryClient: QueryClient) => {
  queryClient.clear();
  await clearBrowserAppCaches();
};
