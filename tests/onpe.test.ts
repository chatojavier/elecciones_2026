import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function successResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function importOnpeWithEnv(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import("../netlify/functions/_shared/onpe");
}

describe("onpe request limiter and timeout", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("limita concurrencia global y drena la cola en FIFO", async () => {
    const fetchDeferreds: Array<Deferred<Response>> = [];
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(() => {
      const deferred = createDeferred<Response>();
      fetchDeferreds.push(deferred);
      return deferred.promise;
    });

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "2",
      ONPE_REQUEST_TIMEOUT_MS: "10000"
    });

    const calls = [
      onpe.fetchDepartments(),
      onpe.fetchDepartments(),
      onpe.fetchDepartments(),
      onpe.fetchDepartments(),
      onpe.fetchDepartments()
    ];

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchDeferreds[0].resolve(successResponse([]));
    await calls[0];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    fetchDeferreds[1].resolve(successResponse([]));
    await calls[1];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    fetchDeferreds[2].resolve(successResponse([]));
    fetchDeferreds[3].resolve(successResponse([]));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));

    fetchDeferreds[4].resolve(successResponse([]));
    await Promise.all(calls);
  });

  it("aplica timeout por request y no filtra secretos", async () => {
    vi.useFakeTimers();
    const cookieValue = "super-secret-cookie";
    let abortTriggered = false;
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation((_, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          abortTriggered = true;
          const abortError = new Error("Aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "1",
      ONPE_REQUEST_TIMEOUT_MS: "15",
      ONPE_COOKIE: cookieValue
    });

    const request = onpe.fetchNationalTotals();
    request.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(16);

    await expect(request).rejects.toThrow(
      "ONPE excedió timeout de 15ms para /resumen-general/totales"
    );
    expect(abortTriggered).toBe(true);

    await request.catch((error: Error) => {
      expect(error.message).not.toContain("Cookie");
      expect(error.message).not.toContain("ONPE_COOKIE");
      expect(error.message).not.toContain(cookieValue);
    });
  });

  it("libera slot cuando un timeout falla y permite continuar la cola", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(globalThis.fetch);
    const started: number[] = [];

    fetchMock.mockImplementation((_, init) => {
      started.push(started.length + 1);
      if (started.length === 1) {
        const signal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            const abortError = new Error("Aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        });
      }

      return Promise.resolve(successResponse([]));
    });

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "1",
      ONPE_REQUEST_TIMEOUT_MS: "10"
    });

    const first = onpe.fetchDepartments();
    const second = onpe.fetchDepartments();
    first.catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(11);
    await expect(first).rejects.toThrow("ONPE excedió timeout de 10ms para /ubigeos/departamentos");

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(second).resolves.toEqual([]);
  });

  it("falla con mensaje controlado si ONPE devuelve JSON invalido", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response("{ bad json", {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "1",
      ONPE_REQUEST_TIMEOUT_MS: "10000"
    });

    await expect(onpe.fetchDepartments()).rejects.toThrow(
      "ONPE devolvió JSON inválido para /ubigeos/departamentos"
    );
  });

  it("falla con mensaje controlado si success=false", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, data: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "1",
      ONPE_REQUEST_TIMEOUT_MS: "10000"
    });

    await expect(onpe.fetchDepartments()).rejects.toThrow(
      "Contrato ONPE invalido para /ubigeos/departamentos invalido en success: se esperaba true"
    );
  });

  it("falla con mensaje controlado si data es null", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "1",
      ONPE_REQUEST_TIMEOUT_MS: "10000"
    });

    await expect(onpe.fetchDepartments()).rejects.toThrow(
      "Contrato ONPE invalido para /ubigeos/departamentos invalido en data: se esperaba valor no nulo"
    );
  });

  it("falla cuando totales no cumple contrato", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      successResponse({
        fechaActualizacion: "bad-date"
      })
    );

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "1",
      ONPE_REQUEST_TIMEOUT_MS: "10000"
    });

    await expect(onpe.fetchNationalTotals()).rejects.toThrow("data.actasContabilizadas");
  });

  it("falla cuando participantes no cumple contrato", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      successResponse([
        {
          nombreAgrupacionPolitica: "PARTIDO",
          codigoAgrupacionPolitica: "4"
        }
      ])
    );

    const onpe = await importOnpeWithEnv({
      ONPE_REQUEST_CONCURRENCY: "1",
      ONPE_REQUEST_TIMEOUT_MS: "10000"
    });

    await expect(onpe.fetchNationalParticipants()).rejects.toThrow(
      "data[0].nombreCandidato"
    );
  });
});
