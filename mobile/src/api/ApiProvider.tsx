import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import type { LocalDate } from '@/domain/types';

import type { ApiClient } from './client';

const ApiContext = createContext<ApiClient | null>(null);

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });
}

export function ApiProvider({
  client,
  queryClient,
  children,
}: {
  client: ApiClient;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [qc] = useState(() => queryClient ?? makeQueryClient());
  return (
    <ApiContext.Provider value={client}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
}

export function useApi(): ApiClient {
  const c = useContext(ApiContext);
  if (!c) throw new Error('useApi must be used inside <ApiProvider>');
  return c;
}

export const queryKeys = {
  me: ['me'] as const,
  day: (d: LocalDate) => ['day', d] as const,
  days: (from: LocalDate, to: LocalDate) => ['days', from, to] as const,
  allDays: ['day'] as const,
};

export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.getMe() });
}

export function useDay(localDate: LocalDate) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.day(localDate), queryFn: () => api.getDay(localDate) });
}

export function useDays(from: LocalDate, to: LocalDate) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.days(from, to), queryFn: () => api.getDays(from, to) });
}
