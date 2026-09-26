import { QueryClient } from "@tanstack/react-query";

import { defaultQueryClientOptions } from "@/lib/query";

export const appQueryClient = new QueryClient({
  defaultOptions: defaultQueryClientOptions,
});
