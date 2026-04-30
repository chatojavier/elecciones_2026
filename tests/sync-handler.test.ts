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

import { handler } from "../netlify/functions/sync";

function createEvent(overrides: Partial<Parameters<typeof handler>[0]> = {}) {
  return {
    rawUrl: "http://localhost/.netlify/functions/sync",
    rawQuery: "",
    path: "/.netlify/functions/sync",
    httpMethod: "POST",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...overrides
  };
}

function createSnapshot() {
  return {
    generatedAt: "2026-04-21T12:01:00.000Z"
  };
}

function createHealth() {
  return {
    status: "healthy",
    source: "onpe",
    lastSyncAt: "2026-04-21T12:01:00.000Z",
    lastSuccessAt: "2026-04-21T12:01:00.000Z",
    staleMinutes: 0,
    lastError: null
  };
}

describe("sync handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza metodos distintos de POST con 405", async () => {
    const response = await handler(createEvent({ httpMethod: "GET" }), {} as never);

    expect(runSyncFlowMock).not.toHaveBeenCalled();
    expect(response?.statusCode).toBe(405);
    expect(response?.headers?.allow).toBe("POST");
    expect(response?.body).toBe(JSON.stringify({ ok: false, error: "invalid_method" }));
  });

  it("devuelve 202 cuando ya hay un sync en curso", async () => {
    runSyncFlowMock.mockResolvedValue({
      state: "in_progress",
      statusCode: 202
    });

    const response = await handler(createEvent(), {} as never);

    expect(runSyncFlowMock).toHaveBeenCalledWith("manual");
    expect(response?.statusCode).toBe(202);
    expect(response?.body).toBe(JSON.stringify({ ok: true, state: "in_progress" }));
  });

  it("devuelve 429 cuando existe un sync reciente", async () => {
    runSyncFlowMock.mockResolvedValue({
      state: "recent",
      statusCode: 429,
      retryAfterSeconds: 120
    });

    const response = await handler(createEvent(), {} as never);

    expect(response?.statusCode).toBe(429);
    expect(response?.headers?.["retry-after"]).toBe("120");
    expect(response?.body).toBe(JSON.stringify({ ok: true, state: "recent" }));
  });

  it("devuelve snapshot y health cuando el sync corre", async () => {
    const snapshot = createSnapshot();
    const health = createHealth();
    runSyncFlowMock.mockResolvedValue({
      state: "synced",
      statusCode: 200,
      snapshot,
      health
    });

    const response = await handler(createEvent(), {} as never);

    expect(response?.statusCode).toBe(200);
    expect(response?.body).toBe(
      JSON.stringify({
        ok: true,
        state: "synced",
        snapshot,
        health
      })
    );
  });

  it("sanitiza errores internos con 500", async () => {
    runSyncFlowMock.mockRejectedValue(new Error("ONPE timeout"));

    const response = await handler(createEvent(), {} as never);

    expect(response?.statusCode).toBe(500);
    expect(response?.body).toBe(JSON.stringify({ ok: false, error: "sync_failed" }));
  });
});
