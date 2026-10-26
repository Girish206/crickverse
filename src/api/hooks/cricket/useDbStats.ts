import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../client";
import type { ApiEnvelope, DbStats } from "../../types";

// Super admins: the database's size, collection by collection.
export function useDbStats() {
  return useQuery({
    queryKey: ["db-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<DbStats>>("/admin/cricket/db-stats");
      return data.data;
    },
  });
}
