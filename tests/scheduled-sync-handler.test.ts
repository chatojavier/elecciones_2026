import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectLambdaMock, runSyncFlowMock } = vi.hoisted(() => ({
  connectLambdaMock: vi.fn(),
  runSyncFlowMock: vi.fn()
}));

vi.mock("@netlify/blobs", () => ({
  connectLambda: connectLambdaMock
}));

vi.mock("../netlify/functions/_shared/sync", () => ({
  runSyncFlow: runSyncFlowMock
}));

import { handler } from "../netlify/functions/scheduled-sync";

function createEvent(overrides: Partial<Parameters<typeof handler>[0]> = {}) {
  return {
    rawUrl: "http://localhost/.netlify/functions/scheduled-sync",
    rawQuery: "",
    path: "/.netlify/functions/scheduled-sync",
    httpMethod: "GET",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...overrides
  };
}

describe("scheduled sync handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza invocaciones no programadas con 401", async () => {
    const response = await handler(createEvent(), {} as never);

    expect(runSyncFlowMock).not.toHaveBeenCalled();
    expect(response?.statusCode).toBe(401);
    expect(response?.body).toBe(JSON.stringify({ ok: false, error: "unauthorized" }));
  });

  it("ejecuta el flujo compartido cuando Netlify marca un evento schedule", async () => {
    runSyncFlowMock.mockResolvedValue({
      state: "in_progress",
      statusCode: 202
    });

    const response = await handler(
      createEvent({
        headers: {
          "x-nf-event": "schedule"
        }
      }),
      {} as never
    );

    expect(runSyncFlowMock).toHaveBeenCalledWith("scheduled");
    expect(response?.statusCode).toBe(202);
    expect(response?.body).toBe(JSON.stringify({ ok: true, state: "in_progress" }));
  });
});
