import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const setJSONMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    get: getMock,
    setJSON: setJSONMock,
    delete: deleteMock
  })
}));

import { readHealth, readSnapshot } from "../netlify/functions/_shared/storage";
import { SECOND_ROUND_STORAGE } from "../netlify/functions/_shared/config";

function createSnapshot() {
  const baseScope = {
    scopeId: "1",
    kind: "national",
    label: "PERU",
    electores: 1000,
    padronShare: 100,
    actasContabilizadasPct: 80,
    contabilizadas: 80,
    totalActas: 100,
    participacionCiudadanaPct: 70,
    enviadasJee: 0,
    pendientesJee: 0,
    totalVotosEmitidos: 850,
    totalVotosValidos: 800,
    sourceUpdatedAt: "2026-04-21T12:00:00.000Z",
    candidates: [],
    featuredCandidates: [],
    otros: {
      code: "otros",
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    },
    projectedVotes: {}
  };

  return {
    round: "first",
    generatedAt: "2026-04-21T12:01:00.000Z",
    sourceElectionId: 10,
    sourceLastUpdatedAt: "2026-04-21T12:00:00.000Z",
    national: baseScope,
    foreign: {
      ...baseScope,
      scopeId: "2",
      kind: "foreign_total",
      continents: []
    },
    regions: [],
    projectedNational: {
      totalElectores: 1000,
      totalProjectedValidVotes: 800,
      projectedVotes: {},
      projectedPercentages: {}
    },
    featuredCandidateCodes: [],
    isStale: false
  };
}

describe("storage contract parsing", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("readSnapshot ignora blob invalido", async () => {
    getMock.mockResolvedValue({ generatedAt: "x" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await readSnapshot();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("readSnapshot retorna snapshot valido", async () => {
    getMock.mockResolvedValue(createSnapshot());
    const result = await readSnapshot();
    expect(result?.foreign.continents).toEqual([]);
  });

  it("readSnapshot ignora blob con round distinto al esperado", async () => {
    getMock.mockResolvedValue({
      ...createSnapshot(),
      round: "second"
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await readSnapshot();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "[storage] snapshot round mismatch ignored: expected first, got second"
    );
    warnSpy.mockRestore();
  });

  it("readSnapshot acepta round coincidente para segunda vuelta", async () => {
    getMock.mockResolvedValue({
      ...createSnapshot(),
      round: "second"
    });

    const result = await readSnapshot(SECOND_ROUND_STORAGE);

    expect(result?.round).toBe("second");
  });

  it("readHealth ignora blob invalido", async () => {
    getMock.mockResolvedValue({ status: "healthy" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await readHealth();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
