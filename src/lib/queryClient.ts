import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Central query-key factory. Every key is workspace-scoped so
 * switching workspaces never leaks cached data across tenants.
 */
export const qk = {
  profile: (userId: string) => ['profile', userId] as const,
  workspaces: (userId: string) => ['workspaces', userId] as const,

  products: (ws: string, params?: unknown) => ['products', ws, params] as const,
  product: (ws: string, id: string) => ['products', ws, 'detail', id] as const,
  categories: (ws: string) => ['categories', ws] as const,
  suppliers: (ws: string, params?: unknown) => ['suppliers', ws, params] as const,
  warehouses: (ws: string) => ['warehouses', ws] as const,

  stockLevels: (ws: string, params?: unknown) => ['stock-levels', ws, params] as const,
  movements: (ws: string, params?: unknown) => ['movements', ws, params] as const,

  purchaseOrders: (ws: string, params?: unknown) => ['purchase-orders', ws, params] as const,
  purchaseOrder: (ws: string, id: string) => ['purchase-orders', ws, 'detail', id] as const,

  alerts: (ws: string, params?: unknown) => ['alerts', ws, params] as const,
  activity: (ws: string, params?: unknown) => ['activity', ws, params] as const,
  team: (ws: string) => ['team', ws] as const,
  settings: (ws: string) => ['settings', ws] as const,

  webhookEndpoints: (ws: string) => ['integrations', ws, 'endpoints'] as const,
  externalOrders: (ws: string, params?: unknown) => ['integrations', ws, 'orders', params] as const,

  adminWorkspaces: () => ['admin', 'workspaces'] as const,
  adminStats: () => ['admin', 'stats'] as const,

  dashboardStats: (ws: string) => ['analytics', ws, 'dashboard'] as const,
  movementSeries: (ws: string, days: number) => ['analytics', ws, 'series', days] as const,
  stockByCategory: (ws: string) => ['analytics', ws, 'by-category'] as const,
  topProducts: (ws: string, limit: number) => ['analytics', ws, 'top-products', limit] as const,
};

/** Invalidate everything that depends on stock state. */
export function invalidateStock(client: QueryClient, ws: string) {
  void client.invalidateQueries({ queryKey: ['stock-levels', ws] });
  void client.invalidateQueries({ queryKey: ['movements', ws] });
  void client.invalidateQueries({ queryKey: ['products', ws] });
  void client.invalidateQueries({ queryKey: ['alerts', ws] });
  void client.invalidateQueries({ queryKey: ['analytics', ws] });
  void client.invalidateQueries({ queryKey: ['activity', ws] });
}
