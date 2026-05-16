import { describe, expect, it } from "vitest";

import type {
  ForeignContinentResult,
  ForeignResult,
  NationalResult,
  RegionResult,
  ScopeResult
} from "../src/lib/types";

const scopeCore = {
  scopeId: "1",
  label: "PERÚ",
  actasContabilizadasPct: 80,
  contabilizadas: 80,
  totalActas: 100,
  participacionCiudadanaPct: 70,
  enviadasJee: 0,
  pendientesJee: 0,
  totalVotosEmitidos: 900,
  totalVotosValidos: 800,
  sourceUpdatedAt: "2026-05-16T00:00:00.000Z",
  candidates: [],
  featuredCandidates: [],
  otros: {
    code: "otros" as const,
    label: "Otros",
    votesValid: 0,
    pctValid: 0,
    pctEmitted: 0
  },
  projectedVotes: { otros: 0 }
};

const electorateCore = {
  ...scopeCore,
  electores: 1000,
  padronShare: 50
};

describe("scope result types", () => {
  it("accepts valid discriminated union members", () => {
    const national: NationalResult = {
      ...electorateCore,
      kind: "national"
    };
    const region: RegionResult = {
      ...electorateCore,
      kind: "department",
      provinces: []
    };
    const continent: ForeignContinentResult = {
      ...electorateCore,
      kind: "foreign_continent",
      countries: []
    };
    const foreign: ForeignResult = {
      ...electorateCore,
      kind: "foreign_total",
      continents: []
    };

    const finalScopes: ScopeResult[] = [national, region, continent, foreign];
    expect(finalScopes).toHaveLength(4);
  });

  it("rejects invalid parent shapes at compile time", () => {
    // @ts-expect-error foreign_continent requires countries
    const invalidContinent: ForeignContinentResult = {
      ...electorateCore,
      kind: "foreign_continent"
    };
    // @ts-expect-error department requires provinces
    const invalidRegion: RegionResult = {
      ...electorateCore,
      kind: "department"
    };
    // @ts-expect-error ScopeResult cannot represent foreign_continent without countries
    const invalidScopeContinent: ScopeResult = {
      ...electorateCore,
      kind: "foreign_continent"
    };
    // @ts-expect-error ScopeResult cannot represent department without provinces
    const invalidScopeRegion: ScopeResult = {
      ...electorateCore,
      kind: "department"
    };

    expect(
      invalidContinent ?? invalidRegion ?? invalidScopeContinent ?? invalidScopeRegion
    ).toBeDefined();
  });
});
