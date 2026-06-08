import { describe, expect, it } from "vitest";

import {
  ContractValidationError,
  parseElectionSnapshot,
  parseHealthStatus,
  parseOnpeDepartments,
  parseOnpeParticipants,
  parseOnpeProvinces,
  parseOnpeTotals
} from "../src/lib/contracts";
import { normalizeElectionSnapshot } from "../src/lib/normalizeSnapshot";
import type { ElectionSnapshot } from "../src/lib/types";

function createSnapshot(): ElectionSnapshot {
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

describe("contracts", () => {
  it("parseElectionSnapshot rechaza campos requeridos faltantes", () => {
    expect(() => parseElectionSnapshot({})).toThrow(ContractValidationError);
    expect(() =>
      parseElectionSnapshot({
        ...createSnapshot(),
        national: undefined
      })
    ).toThrow("national");
  });

  it("parseElectionSnapshot valida fechas ISO", () => {
    expect(() =>
      parseElectionSnapshot({
        ...createSnapshot(),
        generatedAt: "not-date"
      })
    ).toThrow("generatedAt");
  });

  it("acepta snapshot legacy sin continentes/countries y normalize los completa", () => {
    const raw = createSnapshot() as unknown as Record<string, unknown>;
    const parsed = parseElectionSnapshot({
      ...raw,
      foreign: {
        ...(raw.foreign as Record<string, unknown>),
        continents: [
          {
            ...(raw.foreign as Record<string, unknown>),
            kind: "foreign_continent",
            scopeId: "920000",
            label: "EUROPA"
          }
        ]
      }
    });

    const normalized = normalizeElectionSnapshot(parsed);
    expect(normalized.foreign.continents[0]?.countries).toEqual([]);
  });

  it("acepta provincias y paises extranjeros sin electores ni padronShare", () => {
    const snapshot = createSnapshot();
    const { electores: _electores, padronShare: _padronShare, ...childCore } = snapshot.national;
    const province = {
      ...childCore,
      scopeId: "0101",
      parentScopeId: "01",
      kind: "province",
      label: "CHACHAPOYAS"
    };
    const country = {
      ...childCore,
      scopeId: "920001",
      parentScopeId: "920000",
      kind: "foreign_country",
      label: "ESPANA"
    };

    const parsed = parseElectionSnapshot({
      ...snapshot,
      regions: [
        {
          ...snapshot.national,
          scopeId: "01",
          kind: "department",
          label: "AMAZONAS",
          provinces: [province]
        }
      ],
      foreign: {
        ...snapshot.foreign,
        continents: [
          {
            ...snapshot.foreign,
            scopeId: "920000",
            kind: "foreign_continent",
            label: "EUROPA",
            countries: [country]
          }
        ]
      }
    });

    expect(parsed.regions[0]?.provinces[0]).toMatchObject({
      scopeId: "0101",
      kind: "province"
    });
    expect(parsed.foreign.continents[0]?.countries[0]).toMatchObject({
      scopeId: "920001",
      kind: "foreign_country"
    });
  });

  it("parseHealthStatus valida enums y fechas", () => {
    expect(() => parseHealthStatus({ status: "bad" })).toThrow("status");
    expect(() =>
      parseHealthStatus({
        status: "healthy",
        source: "onpe",
        lastSyncAt: "bad",
        lastSuccessAt: null,
        staleMinutes: null,
        lastError: null
      })
    ).toThrow("lastSyncAt");
  });

  it("parseOnpeTotals valida numeros requeridos", () => {
    expect(() => parseOnpeTotals({ fechaActualizacion: "bad" })).toThrow(
      "actasContabilizadas"
    );
  });

  it("parseOnpeParticipants valida campos requeridos", () => {
    expect(() =>
      parseOnpeParticipants([
        {
          nombreAgrupacionPolitica: "Partido",
          codigoAgrupacionPolitica: {},
          nombreCandidato: "A",
          dniCandidato: "123",
          totalVotosValidos: 1,
          porcentajeVotosValidos: 1,
          porcentajeVotosEmitidos: 1
        }
      ])
    ).toThrow("codigoAgrupacionPolitica");
  });

  it("parseOnpeDepartments y parseOnpeProvinces validan arreglo y campos", () => {
    expect(() => parseOnpeDepartments({})).toThrow("se esperaba arreglo");
    expect(() => parseOnpeProvinces([{ ubigeo: "01" }])).toThrow("nombre");
  });
});
