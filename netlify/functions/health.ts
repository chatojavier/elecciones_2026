import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { readHealth } from "./_shared/storage";

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

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
