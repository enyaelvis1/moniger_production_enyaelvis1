const MINUTE = 60_000;
const LIVE_REFRESH_INTERVAL = 30_000;

export const defaultQueryClientOptions = {
  queries: {
    gcTime: 10 * MINUTE,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 30_000,
  },
  mutations: {
    retry: 0,
  },
} as const;

export const directoryQueryOptions = {
  gcTime: 15 * MINUTE,
  staleTime: 2 * MINUTE,
} as const;

export const financeQueryOptions = {
  gcTime: 15 * MINUTE,
  staleTime: 2 * MINUTE,
} as const;

export const operationsQueryOptions = {
  gcTime: 10 * MINUTE,
  staleTime: 90_000,
} as const;

export const liveFinanceQueryOptions = {
  refetchInterval: LIVE_REFRESH_INTERVAL,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

export const liveOperationsQueryOptions = {
  refetchInterval: LIVE_REFRESH_INTERVAL,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

export const notificationsFeedQueryOptions = {
  gcTime: 5 * MINUTE,
  staleTime: 20_000,
} as const;

export const notificationPreferencesQueryOptions = {
  gcTime: 15 * MINUTE,
  staleTime: 5 * MINUTE,
} as const;

export const scheduledDigestRunsQueryOptions = {
  gcTime: 10 * MINUTE,
  staleTime: 2 * MINUTE,
} as const;

export const settingsQueryOptions = {
  gcTime: 15 * MINUTE,
  staleTime: 5 * MINUTE,
} as const;

export const securityActivityQueryOptions = {
  gcTime: 10 * MINUTE,
  staleTime: 45_000,
} as const;

export const teamQueryOptions = {
  gcTime: 10 * MINUTE,
  staleTime: 2 * MINUTE,
} as const;

export const invitationPreviewQueryOptions = {
  gcTime: 30 * MINUTE,
  staleTime: 5 * MINUTE,
} as const;

export const sessionInventoryQueryOptions = {
  gcTime: 10 * MINUTE,
  staleTime: 45_000,
} as const;

export const mfaRecoveryQueryOptions = {
  gcTime: 10 * MINUTE,
  staleTime: 60_000,
} as const;

export const globalSearchQueryOptions = {
  gcTime: 5 * MINUTE,
  retry: 0,
  staleTime: 60_000,
} as const;
