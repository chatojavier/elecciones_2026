import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { runSyncFlow } from "./_shared/sync";
import { readSnapshot } from "./_shared/storage";

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  let snapshot = await readSnapshot();

  if (!snapshot) {
    try {
      const result = await runSyncFlow("snapshot_fallback");

      if (result.state === "synced") {
        snapshot = result.snapshot;
      }
    } catch {
      return jsonResponse(
        {
          error: "snapshot_unavailable"
        },
        503
      );
    }
  }

  if (!snapshot) {
    return jsonResponse(
      {
        error: "snapshot_unavailable"
      },
      503
    );
  }

  return jsonResponse(snapshot);
};
