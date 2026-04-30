import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { runSyncFlow } from "./_shared/sync";

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  if (event.httpMethod !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_method"
      },
      405,
      {
        allow: "POST"
      }
    );
  }

  try {
    const result = await runSyncFlow("manual");

    if (result.state === "in_progress") {
      return jsonResponse(
        {
          ok: true,
          state: "in_progress"
        },
        result.statusCode
      );
    }

    if (result.state === "recent") {
      return jsonResponse(
        {
          ok: true,
          state: "recent"
        },
        result.statusCode,
        {
          "retry-after": String(result.retryAfterSeconds)
        }
      );
    }

    return jsonResponse({
      ok: true,
      state: "synced",
      snapshot: result.snapshot,
      health: result.health
    });
  } catch (error) {
    console.error("[sync] manual sync failed", error);
    return jsonResponse(
      {
        ok: false,
        error: "sync_failed"
      },
      500
    );
  }
};
