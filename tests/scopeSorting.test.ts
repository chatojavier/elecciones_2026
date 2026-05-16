import { describe, expect, it } from "vitest";

import type { ComparisonPair } from "../src/lib/comparison";
import {
  sortForeignContinents,
  sortLeafScopes,
  sortRegions,
  type LeafScopeResult
} from "../src/lib/scopeSorting";
import type {
  CandidateResult,
  ForeignContinentResult,
  ForeignCountryResult,
  ProvinceResult,
  RegionResult
} from "../src/lib/types";

const comparisonPair: ComparisonPair = {
  candidateACode: "8",
  candidateBCode: "10"
};

function createCandidate(code: string, votesValid: number, pctValid: number): CandidateResult {
  return {
    code,
    partyName: `PARTIDO ${code}`,
    candidateName: `CANDIDATO ${code}`,
    votesValid,
    pctValid,
    pctEmitted: pctValid
  };
}

interface ScopeFixtureInput {
  scopeId: string;
  label: string;
  actas: number;
  participacion: number;
  totalVotosValidos: number;
  candidateAPct: number;
  candidateAVotes: number;
  candidateBVotes: number;
  projectedA: number;
  projectedB: number;
}

function createProvince(input: ScopeFixtureInput): ProvinceResult {
  return {
    scopeId: input.scopeId,
    parentScopeId: "040000",
    kind: "province",
    label: input.label,
    actasContabilizadasPct: input.actas,
    contabilizadas: input.actas,
    totalActas: 100,
    participacionCiudadanaPct: input.participacion,
    enviadasJee: 0,
    pendientesJee: 0,
    totalVotosEmitidos: input.totalVotosValidos,
    totalVotosValidos: input.totalVotosValidos,
    sourceUpdatedAt: "2026-05-16T00:00:00.000Z",
    candidates: [
      createCandidate("8", input.candidateAVotes, input.candidateAPct),
      createCandidate("10", input.candidateBVotes, 100 - input.candidateAPct)
    ],
    featuredCandidates: [
      createCandidate("8", input.candidateAVotes, input.candidateAPct),
      createCandidate("10", input.candidateBVotes, 100 - input.candidateAPct)
    ],
    otros: {
      code: "otros",
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    },
    projectedVotes: {
      "8": input.projectedA,
      "10": input.projectedB,
      otros: 0
    }
  };
}

function createForeignCountry(input: ScopeFixtureInput): ForeignCountryResult {
  return {
    ...createProvince(input),
    kind: "foreign_country",
    parentScopeId: "920000"
  };
}

interface RegionFixtureInput extends ScopeFixtureInput {
  electores: number;
}

function createRegion(input: RegionFixtureInput): RegionResult {
  return {
    scopeId: input.scopeId,
    kind: "department",
    label: input.label,
    electores: input.electores,
    padronShare: 1,
    actasContabilizadasPct: input.actas,
    contabilizadas: input.actas,
    totalActas: 100,
    participacionCiudadanaPct: input.participacion,
    enviadasJee: 0,
    pendientesJee: 0,
    totalVotosEmitidos: input.totalVotosValidos,
    totalVotosValidos: input.totalVotosValidos,
    sourceUpdatedAt: "2026-05-16T00:00:00.000Z",
    candidates: [
      createCandidate("8", input.candidateAVotes, input.candidateAPct),
      createCandidate("10", input.candidateBVotes, 100 - input.candidateAPct)
    ],
    featuredCandidates: [
      createCandidate("8", input.candidateAVotes, input.candidateAPct),
      createCandidate("10", input.candidateBVotes, 100 - input.candidateAPct)
    ],
    otros: {
      code: "otros",
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    },
    projectedVotes: {
      "8": input.projectedA,
      "10": input.projectedB,
      otros: 0
    },
    provinces: []
  };
}

function createContinent(input: RegionFixtureInput): ForeignContinentResult {
  return {
    ...createRegion(input),
    kind: "foreign_continent",
    countries: []
  };
}

function scopeIds(scopes: Array<{ scopeId: string }>) {
  return scopes.map((scope) => scope.scopeId);
}

describe("scopeSorting - regions", () => {
  it("sorts by electores descending", () => {
    const regions = [
      createRegion({
        scopeId: "r1",
        label: "R1",
        electores: 1200,
        actas: 70,
        participacion: 65,
        totalVotosValidos: 400,
        candidateAPct: 40,
        candidateAVotes: 160,
        candidateBVotes: 140,
        projectedA: 170,
        projectedB: 130
      }),
      createRegion({
        scopeId: "r2",
        label: "R2",
        electores: 800,
        actas: 80,
        participacion: 75,
        totalVotosValidos: 500,
        candidateAPct: 30,
        candidateAVotes: 150,
        candidateBVotes: 170,
        projectedA: 160,
        projectedB: 180
      }),
      createRegion({
        scopeId: "r3",
        label: "R3",
        electores: 2000,
        actas: 60,
        participacion: 55,
        totalVotosValidos: 300,
        candidateAPct: 20,
        candidateAVotes: 60,
        candidateBVotes: 120,
        projectedA: 90,
        projectedB: 160
      })
    ];

    const sorted = sortRegions(regions, "electores", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["r3", "r1", "r2"]);
  });

  it("sorts by actas descending", () => {
    const regions = [
      createRegion({
        scopeId: "r1",
        label: "R1",
        electores: 1200,
        actas: 70,
        participacion: 65,
        totalVotosValidos: 400,
        candidateAPct: 40,
        candidateAVotes: 160,
        candidateBVotes: 140,
        projectedA: 170,
        projectedB: 130
      }),
      createRegion({
        scopeId: "r2",
        label: "R2",
        electores: 800,
        actas: 80,
        participacion: 75,
        totalVotosValidos: 500,
        candidateAPct: 30,
        candidateAVotes: 150,
        candidateBVotes: 170,
        projectedA: 160,
        projectedB: 180
      }),
      createRegion({
        scopeId: "r3",
        label: "R3",
        electores: 2000,
        actas: 60,
        participacion: 55,
        totalVotosValidos: 300,
        candidateAPct: 20,
        candidateAVotes: 60,
        candidateBVotes: 120,
        projectedA: 90,
        projectedB: 160
      })
    ];

    const sorted = sortRegions(regions, "actas", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["r2", "r1", "r3"]);
  });

  it("sorts by participacion descending", () => {
    const regions = [
      createRegion({
        scopeId: "r1",
        label: "R1",
        electores: 1200,
        actas: 70,
        participacion: 65,
        totalVotosValidos: 400,
        candidateAPct: 40,
        candidateAVotes: 160,
        candidateBVotes: 140,
        projectedA: 170,
        projectedB: 130
      }),
      createRegion({
        scopeId: "r2",
        label: "R2",
        electores: 800,
        actas: 80,
        participacion: 75,
        totalVotosValidos: 500,
        candidateAPct: 30,
        candidateAVotes: 150,
        candidateBVotes: 170,
        projectedA: 160,
        projectedB: 180
      }),
      createRegion({
        scopeId: "r3",
        label: "R3",
        electores: 2000,
        actas: 60,
        participacion: 55,
        totalVotosValidos: 300,
        candidateAPct: 20,
        candidateAVotes: 60,
        candidateBVotes: 120,
        projectedA: 90,
        projectedB: 160
      })
    ];

    const sorted = sortRegions(regions, "participacion", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["r2", "r1", "r3"]);
  });

  it("sorts candidate by candidate A percentage and tie-breaks by electores", () => {
    const regions = [
      createRegion({
        scopeId: "r1",
        label: "R1",
        electores: 900,
        actas: 70,
        participacion: 65,
        totalVotosValidos: 400,
        candidateAPct: 45,
        candidateAVotes: 180,
        candidateBVotes: 120,
        projectedA: 170,
        projectedB: 130
      }),
      createRegion({
        scopeId: "r2",
        label: "R2",
        electores: 1200,
        actas: 80,
        participacion: 75,
        totalVotosValidos: 500,
        candidateAPct: 40,
        candidateAVotes: 200,
        candidateBVotes: 180,
        projectedA: 160,
        projectedB: 180
      }),
      createRegion({
        scopeId: "r3",
        label: "R3",
        electores: 800,
        actas: 60,
        participacion: 55,
        totalVotosValidos: 300,
        candidateAPct: 40,
        candidateAVotes: 120,
        candidateBVotes: 100,
        projectedA: 90,
        projectedB: 160
      })
    ];

    const sorted = sortRegions(regions, "candidate", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["r1", "r2", "r3"]);
  });

  it("sorts projection by candidate A projected votes and tie-breaks by electores", () => {
    const regions = [
      createRegion({
        scopeId: "r1",
        label: "R1",
        electores: 900,
        actas: 70,
        participacion: 65,
        totalVotosValidos: 400,
        candidateAPct: 45,
        candidateAVotes: 180,
        candidateBVotes: 120,
        projectedA: 300,
        projectedB: 130
      }),
      createRegion({
        scopeId: "r2",
        label: "R2",
        electores: 1200,
        actas: 80,
        participacion: 75,
        totalVotosValidos: 500,
        candidateAPct: 40,
        candidateAVotes: 200,
        candidateBVotes: 180,
        projectedA: 240,
        projectedB: 180
      }),
      createRegion({
        scopeId: "r3",
        label: "R3",
        electores: 800,
        actas: 60,
        participacion: 55,
        totalVotosValidos: 300,
        candidateAPct: 40,
        candidateAVotes: 120,
        candidateBVotes: 100,
        projectedA: 240,
        projectedB: 160
      })
    ];

    const sorted = sortRegions(regions, "projection", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["r1", "r2", "r3"]);
  });

  it("sorts gap_2v3 ascending and tie-breaks by electores", () => {
    const regions = [
      createRegion({
        scopeId: "r1",
        label: "R1",
        electores: 900,
        actas: 70,
        participacion: 65,
        totalVotosValidos: 400,
        candidateAPct: 45,
        candidateAVotes: 180,
        candidateBVotes: 120,
        projectedA: 100,
        projectedB: 260
      }),
      createRegion({
        scopeId: "r2",
        label: "R2",
        electores: 1200,
        actas: 80,
        participacion: 75,
        totalVotosValidos: 500,
        candidateAPct: 40,
        candidateAVotes: 200,
        candidateBVotes: 180,
        projectedA: 180,
        projectedB: 230
      }),
      createRegion({
        scopeId: "r3",
        label: "R3",
        electores: 800,
        actas: 60,
        participacion: 55,
        totalVotosValidos: 300,
        candidateAPct: 40,
        candidateAVotes: 120,
        candidateBVotes: 100,
        projectedA: 150,
        projectedB: 200
      })
    ];

    const sorted = sortRegions(regions, "gap_2v3", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["r1", "r2", "r3"]);
  });

  it("does not mutate the original regions array", () => {
    const regions = [
      createRegion({
        scopeId: "r1",
        label: "R1",
        electores: 900,
        actas: 70,
        participacion: 65,
        totalVotosValidos: 400,
        candidateAPct: 45,
        candidateAVotes: 180,
        candidateBVotes: 120,
        projectedA: 100,
        projectedB: 260
      }),
      createRegion({
        scopeId: "r2",
        label: "R2",
        electores: 1200,
        actas: 80,
        participacion: 75,
        totalVotosValidos: 500,
        candidateAPct: 40,
        candidateAVotes: 200,
        candidateBVotes: 180,
        projectedA: 180,
        projectedB: 230
      })
    ];

    sortRegions(regions, "electores", "projected", comparisonPair);

    expect(scopeIds(regions)).toEqual(["r1", "r2"]);
  });
});

describe("scopeSorting - leaf scopes", () => {
  const scopes: LeafScopeResult[] = [
    createProvince({
      scopeId: "p1",
      label: "P1",
      actas: 70,
      participacion: 65,
      totalVotosValidos: 400,
      candidateAPct: 45,
      candidateAVotes: 180,
      candidateBVotes: 120,
      projectedA: 300,
      projectedB: 130
    }),
    createForeignCountry({
      scopeId: "c1",
      label: "C1",
      actas: 80,
      participacion: 75,
      totalVotosValidos: 600,
      candidateAPct: 40,
      candidateAVotes: 200,
      candidateBVotes: 180,
      projectedA: 240,
      projectedB: 200
    }),
    createProvince({
      scopeId: "p2",
      label: "P2",
      actas: 60,
      participacion: 55,
      totalVotosValidos: 500,
      candidateAPct: 40,
      candidateAVotes: 120,
      candidateBVotes: 100,
      projectedA: 240,
      projectedB: 290
    })
  ];

  it("sorts actas descending", () => {
    const sorted = sortLeafScopes(scopes, "actas", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["c1", "p1", "p2"]);
  });

  it("sorts participacion descending", () => {
    const sorted = sortLeafScopes(scopes, "participacion", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["c1", "p1", "p2"]);
  });

  it("sorts candidate by candidate A percentage and tie-breaks by total votos validos", () => {
    const sorted = sortLeafScopes(scopes, "candidate", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["p1", "c1", "p2"]);
  });

  it("sorts projection by candidate A projected votes and tie-breaks by total votos validos", () => {
    const sorted = sortLeafScopes(scopes, "projection", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["p1", "c1", "p2"]);
  });

  it("sorts gap_2v3 ascending and tie-breaks by total votos validos", () => {
    const sorted = sortLeafScopes(scopes, "gap_2v3", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["p2", "c1", "p1"]);
  });

  it("falls back to gap_2v3 behavior when sort key is electores", () => {
    const sortedByElectores = sortLeafScopes(scopes, "electores", "projected", comparisonPair);
    const sortedByGap = sortLeafScopes(scopes, "gap_2v3", "projected", comparisonPair);

    expect(scopeIds(sortedByElectores)).toEqual(scopeIds(sortedByGap));
  });
});

describe("scopeSorting - foreign continents", () => {
  const continents = [
    createContinent({
      scopeId: "f1",
      label: "F1",
      electores: 1000,
      actas: 70,
      participacion: 65,
      totalVotosValidos: 900,
      candidateAPct: 45,
      candidateAVotes: 180,
      candidateBVotes: 120,
      projectedA: 300,
      projectedB: 130
    }),
    createContinent({
      scopeId: "f2",
      label: "F2",
      electores: 1500,
      actas: 80,
      participacion: 75,
      totalVotosValidos: 1200,
      candidateAPct: 40,
      candidateAVotes: 200,
      candidateBVotes: 180,
      projectedA: 240,
      projectedB: 200
    }),
    createContinent({
      scopeId: "f3",
      label: "F3",
      electores: 900,
      actas: 60,
      participacion: 55,
      totalVotosValidos: 1000,
      candidateAPct: 40,
      candidateAVotes: 120,
      candidateBVotes: 100,
      projectedA: 240,
      projectedB: 290
    })
  ];

  it("sorts electores descending", () => {
    const sorted = sortForeignContinents(continents, "electores", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["f2", "f1", "f3"]);
  });

  it("sorts actas and participacion descending", () => {
    expect(scopeIds(sortForeignContinents(continents, "actas", "projected", comparisonPair))).toEqual([
      "f2",
      "f1",
      "f3"
    ]);
    expect(
      scopeIds(sortForeignContinents(continents, "participacion", "projected", comparisonPair))
    ).toEqual(["f2", "f1", "f3"]);
  });

  it("sorts candidate with tie-break by total votos validos", () => {
    const sorted = sortForeignContinents(continents, "candidate", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["f1", "f2", "f3"]);
  });

  it("sorts projection with tie-break by total votos validos", () => {
    const sorted = sortForeignContinents(continents, "projection", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["f1", "f2", "f3"]);
  });

  it("sorts gap_2v3 ascending with tie-break by total votos validos", () => {
    const sorted = sortForeignContinents(continents, "gap_2v3", "projected", comparisonPair);

    expect(scopeIds(sorted)).toEqual(["f3", "f2", "f1"]);
  });
});
