import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { runSync } from "./_shared/snapshot";

export const config = {
  schedule: "*/15 * * * *"
};

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  try {
    const { health } = await runSync();

    return jsonResponse({
      ok: true,
      health
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: (error as Error).message
      },
      500
    );
  }
};
