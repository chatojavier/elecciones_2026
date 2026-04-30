import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { runSyncFlow } from "./_shared/sync";

export const config = {
  schedule: "*/15 * * * *"
};

function isScheduledInvocation(event: Parameters<Handler>[0]) {
  const scheduleHeader = Object.entries(event.headers).find(([headerName]) => {
    return headerName.toLowerCase() === "x-nf-event";
  });

  return scheduleHeader?.[1] === "schedule";
}

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  if (!isScheduledInvocation(event)) {
    return jsonResponse(
      {
        ok: false,
        error: "unauthorized"
      },
      401
    );
  }

  try {
    const result = await runSyncFlow("scheduled");

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
    console.error("[scheduled-sync] scheduled sync failed", error);
    return jsonResponse(
      {
        ok: false,
        error: "sync_failed"
      },
      500
    );
  }
};
