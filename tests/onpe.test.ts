import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const ORIGINAL_REQUEST_CONCURRENCY = process.env.ONPE_REQUEST_CONCURRENCY;
const ORIGINAL_REQUEST_TIMEOUT_MS = process.env.ONPE_REQUEST_TIMEOUT_MS;

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject
  };
}

function createJsonResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function waitUntil(assertion: () => void, timeoutMs = 250) {
  const startedAt = Date.now();

  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

async function importOnpeModule() {
  vi.resetModules();
  return import("../netlify/functions/_shared/onpe");
}

async function importConfigModule() {
  vi.resetModules();
  return import("../netlify/functions/_shared/config");
}

describe("ONPE transport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete process.env.ONPE_REQUEST_CONCURRENCY;
    delete process.env.ONPE_REQUEST_TIMEOUT_MS;
  });

  afterEach(() => {
    if (ORIGINAL_REQUEST_CONCURRENCY == null) {
      delete process.env.ONPE_REQUEST_CONCURRENCY;
    } else {
      process.env.ONPE_REQUEST_CONCURRENCY = ORIGINAL_REQUEST_CONCURRENCY;
    }

    if (ORIGINAL_REQUEST_TIMEOUT_MS == null) {
      delete process.env.ONPE_REQUEST_TIMEOUT_MS;
    } else {
      process.env.ONPE_REQUEST_TIMEOUT_MS = ORIGINAL_REQUEST_TIMEOUT_MS;
    }

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("limita la concurrencia global de requests ONPE", async () => {
    const gates: Array<Deferred<void>> = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

        const gate = createDeferred<void>();
        gates.push(gate);
        await gate.promise;

        activeRequests -= 1;
        return createJsonResponse([]);
      })
    );

    const onpe = await importOnpeModule();
    const requests = [
      onpe.fetchDepartments(),
      onpe.fetchForeignContinents(),
      onpe.fetchNationalTotals(),
      onpe.fetchNationalParticipants(),
      onpe.fetchForeignTotals(),
      onpe.fetchForeignParticipants(),
      onpe.fetchRegionTotals("01"),
      onpe.fetchRegionParticipants("01"),
      onpe.fetchProvinceTotals("01", "0101"),
      onpe.fetchProvinceParticipants("01", "0101")
    ];

    await waitUntil(() => {
      expect(gates).toHaveLength(6);
    });

    for (const gate of gates.slice(0, 6)) {
      gate.resolve();
    }

    await waitUntil(() => {
      expect(gates).toHaveLength(10);
    });

    for (const gate of gates.slice(6)) {
      gate.resolve();
    }

    await Promise.all(requests);

    expect(maxActiveRequests).toBeLessThanOrEqual(6);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(10);
  });

  it("aborta el request cuando supera el timeout configurado", async () => {
    vi.useFakeTimers();
    process.env.ONPE_REQUEST_TIMEOUT_MS = "25";

    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        });
      })
    );

    const onpe = await importOnpeModule();
    const request = onpe.fetchNationalTotals();
    const requestExpectation = expect(request).rejects.toThrow(
      "ONPE timeout después de 25ms para /resumen-general/totales"
    );

    await vi.advanceTimersByTimeAsync(25);

    await requestExpectation;
  });

  it("libera el slot global cuando un request falla para que la cola siga avanzando", async () => {
    process.env.ONPE_REQUEST_CONCURRENCY = "1";

    const firstGate = createDeferred<void>();
    const secondGate = createDeferred<void>();
    const startedRequests: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        startedRequests.push(new URL(String(input)).pathname);
        const currentCall = startedRequests.length;

        if (currentCall === 1) {
          await firstGate.promise;
          throw new Error("boom");
        }

        await secondGate.promise;
        return createJsonResponse([]);
      })
    );

    const onpe = await importOnpeModule();
    const firstRequest = onpe.fetchNationalTotals();
    const secondRequest = onpe.fetchNationalParticipants();

    await waitUntil(() => {
      expect(startedRequests).toHaveLength(1);
    });

    firstGate.resolve();

    await expect(firstRequest).rejects.toThrow("boom");

    await waitUntil(() => {
      expect(startedRequests).toHaveLength(2);
    });

    secondGate.resolve();

    await expect(secondRequest).resolves.toEqual([]);
  });

  it("usa defaults para concurrencia y timeout cuando faltan o son inválidos", async () => {
    let config = await importConfigModule();

    expect(config.ONPE_REQUEST_CONCURRENCY).toBe(6);
    expect(config.ONPE_REQUEST_TIMEOUT_MS).toBe(8000);

    process.env.ONPE_REQUEST_CONCURRENCY = "0";
    process.env.ONPE_REQUEST_TIMEOUT_MS = "abc";
    config = await importConfigModule();

    expect(config.ONPE_REQUEST_CONCURRENCY).toBe(6);
    expect(config.ONPE_REQUEST_TIMEOUT_MS).toBe(8000);
  });
});
