import { normalizeElectionSnapshot } from "../src/lib/normalizeSnapshot";
import type { ElectionSnapshot } from "../src/lib/types";

const snapshot = {
  generatedAt: new Date("2026-04-16T13:00:00.000Z").toISOString(),
  sourceElectionId: 10,
  sourceLastUpdatedAt: new Date("2026-04-16T12:55:00.000Z").toISOString(),
  national: {
    scopeId: "1",
    kind: "national",
    label: "PERU",
    electores: 1000,
    padronShare: 95,
    actasContabilizadasPct: 80,
    contabilizadas: 80,
    totalActas: 100,
    participacionCiudadanaPct: 70,
    enviadasJee: 0,
    pendientesJee: 0,
    totalVotosEmitidos: 800,
    totalVotosValidos: 700,
    sourceUpdatedAt: new Date("2026-04-16T12:55:00.000Z").toISOString(),
    candidates: [],
    featuredCandidates: [],
    otros: {
      code: "otros",
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    },
    projectedVotes: {
      otros: 0
    }
  },
  foreign: {
    scopeId: "2",
    kind: "foreign_total",
    label: "EXTRANJERO",
    electores: 50,
    padronShare: 5,
    actasContabilizadasPct: 60,
    contabilizadas: 60,
    totalActas: 100,
    participacionCiudadanaPct: 55,
    enviadasJee: 0,
    pendientesJee: 0,
    totalVotosEmitidos: 50,
    totalVotosValidos: 40,
    sourceUpdatedAt: new Date("2026-04-16T12:55:00.000Z").toISOString(),
    candidates: [],
    featuredCandidates: [],
    otros: {
      code: "otros",
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    },
    projectedVotes: {
      otros: 0
    }
  },
  regions: [],
  projectedNational: {
    totalElectores: 1050,
    totalProjectedValidVotes: 700,
    projectedVotes: {
      otros: 700
    },
    projectedPercentages: {
      otros: 100
    }
  },
  featuredCandidateCodes: [],
  isStale: false
} as unknown as ElectionSnapshot;

describe("normalizeElectionSnapshot", () => {
  it("inyecta continentes vacios en snapshots legacy", () => {
    const normalized = normalizeElectionSnapshot(snapshot);

    expect(normalized.foreign.continents).toEqual([]);
  });

  it("inyecta paises vacios cuando falta ese arreglo en un continente", () => {
    const normalized = normalizeElectionSnapshot({
      ...snapshot,
      foreign: {
        ...(snapshot.foreign as unknown as Record<string, unknown>),
        continents: [
          {
            ...(snapshot.foreign as unknown as Record<string, unknown>),
            scopeId: "920000",
            kind: "foreign_continent",
            label: "EUROPA"
          }
        ]
      } as unknown as ElectionSnapshot["foreign"]
    });

    expect(normalized.foreign.continents[0]?.countries).toEqual([]);
  });
});
