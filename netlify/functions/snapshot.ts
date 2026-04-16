import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { runSync } from "./_shared/snapshot";
import { readSnapshot } from "./_shared/storage";

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  let snapshot = await readSnapshot();

  if (!snapshot) {
    try {
      const result = await runSync();
      snapshot = result.snapshot;
    } catch (error) {
      return jsonResponse(
        {
          error: "snapshot_unavailable",
          message: (error as Error).message
        },
        503
      );
    }
  }

  return jsonResponse(snapshot);
};
