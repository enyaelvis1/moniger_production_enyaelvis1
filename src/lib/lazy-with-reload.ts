import { lazy, type ComponentType } from "react";

import { isChunkLoadError } from "@/lib/app-cache";

const CHUNK_RELOAD_KEY = "moniger:chunk-reload-attempted";

export const lazyWithReload = <T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
) =>
  lazy(async () => {
    try {
      const module = await importer();

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      }

      return module;
    } catch (error) {
      if (typeof window === "undefined" || !isChunkLoadError(error)) {
        throw error;
      }

      const hasRetried = window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
      if (hasRetried) {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        throw error;
      }

      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();

      return new Promise<never>(() => undefined);
    }
  });
