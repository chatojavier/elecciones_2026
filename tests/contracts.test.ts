import { describe, expect, it } from "vitest";

import {
  DataContractError,
  parseElectionSnapshot,
  parseHealthStatus,
  parseOnpeEnvelope,
  parseOnpeParticipants
} from "../src/lib/contracts";
import type { ElectionSnapshot, HealthStatus } from "../src/lib/types";

function createSnapshot(overrides: Partial<ElectionSnapshot> = {}): ElectionSnapshot {
  const baseScope = {
    scopeId: "1",
    kind: "national" as const,
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
      code: "otros" as const,
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    },
    projectedVotes: {}
  };

  return {
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
    isStale: false,
    ...overrides
  };
}

function createHealth(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    status: "healthy",
    source: "onpe",
    lastSyncAt: "2026-04-21T12:01:00.000Z",
    lastSuccessAt: "2026-04-21T12:01:00.000Z",
    staleMinutes: 0,
    lastError: null,
    ...overrides
  };
}

describe("runtime contracts", () => {
  it("falla si el snapshot no incluye national", () => {
    const { national: _national, ...snapshot } = createSnapshot();

    expect(() => parseElectionSnapshot(snapshot, "snapshot")).toThrow(DataContractError);
    expect(() => parseElectionSnapshot(snapshot, "snapshot")).toThrow(
      /snapshot.*national/
    );
  });

  it("falla si el snapshot no incluye fechas ISO válidas", () => {
    expect(() =>
      parseElectionSnapshot(
        createSnapshot({
          generatedAt: "ayer"
        }),
        "snapshot"
      )
    ).toThrow(/generatedAt/);
  });

  it("acepta snapshots legacy sin continentes ni países y los normaliza", () => {
    const snapshot = createSnapshot();
    const { continents: _continents, ...foreignWithoutContinents } = snapshot.foreign;
    const parsed = parseElectionSnapshot({
      ...snapshot,
      foreign: {
        ...foreignWithoutContinents,
        continents: [
          {
            ...snapshot.foreign,
            scopeId: "920000",
            kind: "foreign_continent",
            label: "EUROPA"
          }
        ]
      }
    });

    expect(parsed.foreign.continents).toHaveLength(1);
    expect(parsed.foreign.continents[0]?.countries).toEqual([]);
    expect(
      parseElectionSnapshot({
        ...snapshot,
        foreign: foreignWithoutContinents
      }).foreign.continents
    ).toEqual([]);
  });

  it("falla si health tiene shape inválida", () => {
    expect(() =>
      parseHealthStatus(
        createHealth({
          staleMinutes: "0" as unknown as number
        }),
        "health"
      )
    ).toThrow(/staleMinutes/);
  });

  it("falla con mensaje claro si el envelope ONPE trae success=false", () => {
    expect(() =>
      parseOnpeEnvelope(
        {
          success: false,
          message: "Sin datos",
          data: []
        },
        parseOnpeParticipants,
        "onpe:/participantes"
      )
    ).toThrow(/success=false/);
  });

  it("falla con mensaje claro si el payload ONPE tiene shape incompleta", () => {
    expect(() =>
      parseOnpeEnvelope(
        {
          success: true,
          message: "ok",
          data: [
            {
              nombreAgrupacionPolitica: "Partido",
              codigoAgrupacionPolitica: 1,
              nombreCandidato: "Candidata",
              dniCandidato: "12345678",
              porcentajeVotosValidos: 1,
              porcentajeVotosEmitidos: 1
            }
          ]
        },
        parseOnpeParticipants,
        "onpe:/participantes"
      )
    ).toThrow(/data\[0\]\.totalVotosValidos/);
  });
});
