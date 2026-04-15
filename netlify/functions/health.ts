import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { readHealth } from "./_shared/storage";

export const handler: Handler = async () => {
  const health = await readHealth();

  return jsonResponse(
    health ?? {
      status: "unknown",
      source: "onpe",
      lastSyncAt: null,
      lastSuccessAt: null,
      staleMinutes: null,
      lastError: null
    }
  );
};
