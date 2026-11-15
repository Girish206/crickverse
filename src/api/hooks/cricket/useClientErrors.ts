import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type { ApiEnvelope } from "../../types";

// Super admins: the app's crash reports (app-shell/reportError.ts sends
// them), newest first, one row per distinct error with how often it hit.
export interface ClientError {
  id: string;
  message: string;
  stack: string | null;
  where: string | null;
  url: string | null;
  userAgent: string | null;
  native: boolean;
  adminId: number | null;
  count: number;
  firstAt: string;
  lastAt: string;
}

const KEY = ["client-errors"];

export function useClientErrors() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ClientError[]>>("/admin/cricket/client-errors");
      return data.data;
    },
  });
}

// One (fixed), or every one when `id` is null.
export function useDismissClientErrors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | null) => {
      await apiClient.delete(id === null ? "/admin/cricket/client-errors" : `/admin/cricket/client-errors/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
