import {
  buildSecondRoundInsight,
  buildNationalComparisonItems,
  buildScopeComparisonItem,
  getScopeSecondRoundGapVotes
} from "../src/lib/comparison";
import type { ElectionSnapshot, ScopeResult } from "../src/lib/types";

const scope: ScopeResult = {
  scopeId: "1",
  kind: "national",
  label: "PERÚ",
  electores: 1000,
  padronShare: 50,
  actasContabilizadasPct: 80,
  contabilizadas: 80,
  totalActas: 100,
  participacionCiudadanaPct: 70,
  enviadasJee: 0,
  pendientesJee: 0,
  totalVotosEmitidos: 900,
  totalVotosValidos: 800,
  sourceUpdatedAt: new Date().toISOString(),
  candidates: [],
  featuredCandidates: [
    {
      code: "8",
      partyName: "PARTIDO A",
      candidateName: "CANDIDATA A",
      votesValid: 400,
      pctValid: 40,
      pctEmitted: 35
    },
    {
      code: "10",
      partyName: "PARTIDO B",
      candidateName: "CANDIDATO B",
      votesValid: 300,
      pctValid: 30,
      pctEmitted: 26
    }
  ],
  otros: {
    code: "otros",
    label: "Otros",
    votesValid: 100,
    pctValid: 10,
    pctEmitted: 9
  },
  projectedVotes: {
    "8": 500,
    "10": 200,
    otros: 100
  }
};

const snapshot: ElectionSnapshot = {
  generatedAt: new Date().toISOString(),
  sourceElectionId: 10,
  sourceLastUpdatedAt: new Date().toISOString(),
  national: scope,
  foreign: {
    ...scope,
    scopeId: "2",
    kind: "foreign_total",
    label: "EXTRANJERO",
    continents: [],
    totalVotosValidos: 200,
    featuredCandidates: [
      {
        code: "8",
        partyName: "PARTIDO A",
        candidateName: "CANDIDATA A",
        votesValid: 100,
        pctValid: 50,
        pctEmitted: 40
      },
      {
        code: "10",
        partyName: "PARTIDO B",
        candidateName: "CANDIDATO B",
        votesValid: 50,
        pctValid: 25,
        pctEmitted: 20
      }
    ],
    otros: {
      code: "otros",
      label: "Otros",
      votesValid: 50,
      pctValid: 25,
      pctEmitted: 20
    }
  },
  regions: [],
  projectedNational: {
    totalElectores: 1200,
    totalProjectedValidVotes: 1000,
    projectedVotes: {
      "8": 520,
      "10": 180,
      otros: 300
    },
    projectedPercentages: {
      "8": 52,
      "10": 18,
      otros: 30
    }
  },
  featuredCandidateCodes: ["8", "10"],
  isStale: false
};

const secondRoundSnapshot: ElectionSnapshot = {
  ...snapshot,
  national: {
    ...scope,
    featuredCandidates: [
      ...scope.featuredCandidates,
      {
        code: "12",
        partyName: "PARTIDO C",
        candidateName: "CANDIDATA C",
        votesValid: 250,
        pctValid: 25,
        pctEmitted: 22
      }
    ]
  },
  foreign: {
    ...snapshot.foreign,
    featuredCandidates: [
      ...snapshot.foreign.featuredCandidates,
      {
        code: "12",
        partyName: "PARTIDO C",
        candidateName: "CANDIDATA C",
        votesValid: 30,
        pctValid: 15,
        pctEmitted: 12
      }
    ]
  },
  projectedNational: {
    totalElectores: 1200,
    totalProjectedValidVotes: 3000,
    projectedVotes: {
      "8": 1200,
      "10": 780,
      "12": 760,
      otros: 260
    },
    projectedPercentages: {
      "8": 40,
      "10": 26,
      "12": 25.333,
      otros: 8.667
    }
  },
  featuredCandidateCodes: ["8", "10", "12"]
};

describe("buildNationalComparisonItems", () => {
  it("construye actual total, proyectado y delta para destacados y Otros", () => {
    const items = buildNationalComparisonItems(snapshot);

    expect(items.map((item) => item.code)).toEqual(["8", "10", "otros"]);
    expect(items[0]).toMatchObject({
      actualVotes: 500,
      actualPercentage: 50,
      projectedVotes: 520,
      projectedPercentage: 52,
      deltaVotes: 20,
      deltaPercentage: 2
    });
    expect(items[2]).toMatchObject({
      actualVotes: 150,
      actualPercentage: 15,
      projectedVotes: 300,
      deltaVotes: 150,
      deltaPercentage: 15
    });
  });
});

describe("buildScopeComparisonItem", () => {
  it("calcula delta positivo para un candidato con proyección mayor", () => {
    const item = buildScopeComparisonItem(scope, "8");

    expect(item).toMatchObject({
      label: "CANDIDATA A",
      actualVotes: 400,
      projectedVotes: 500,
      projectedPercentage: 62.5,
      deltaVotes: 100,
      deltaPercentage: 22.5
    });
  });

  it("calcula delta negativo para un candidato con proyección menor", () => {
    const item = buildScopeComparisonItem(scope, "10");

    expect(item).toMatchObject({
      label: "CANDIDATO B",
      actualVotes: 300,
      projectedVotes: 200,
      projectedPercentage: 25,
      deltaVotes: -100,
      deltaPercentage: -5
    });
  });

  it("calcula delta cero cuando Otros mantiene el mismo porcentaje", () => {
    const item = buildScopeComparisonItem(
      {
        ...scope,
        otros: {
          ...scope.otros,
          pctValid: 12.5
        },
        projectedVotes: {
          "8": 500,
          "10": 200,
          otros: 100
        }
      },
      "otros"
    );

    expect(item).toMatchObject({
      label: "Otros",
      actualVotes: 100,
      projectedVotes: 100,
      projectedPercentage: 12.5,
      deltaVotes: 0,
      deltaPercentage: 0
    });
  });
});

describe("buildSecondRoundInsight", () => {
  it("ordena por proyectado y calcula brecha 2do vs 3ro excluyendo Otros", () => {
    const insight = buildSecondRoundInsight(secondRoundSnapshot);

    expect(insight.rank2).toMatchObject({
      code: "10",
      label: "CANDIDATO B",
      projectedVotes: 780
    });
    expect(insight.rank3).toMatchObject({
      code: "12",
      label: "CANDIDATA C",
      projectedVotes: 760
    });
    expect(insight.gapVotes2v3).toBe(20);
    expect(insight.gapPp2v3).toBe(0.667);
    expect(insight.statusLevel).toBe("tight");
    expect(insight.actasPeruPct).toBe(80);
    expect(insight.actasExteriorPct).toBe(80);
    expect(insight.deltaProyeccionVotes).toBe(2000);
  });

  it("marca estado muy ajustado cuando la brecha es menor a 0.50 pp", () => {
    const criticalInsight = buildSecondRoundInsight({
      ...secondRoundSnapshot,
      projectedNational: {
        ...secondRoundSnapshot.projectedNational,
        projectedPercentages: {
          ...secondRoundSnapshot.projectedNational.projectedPercentages,
          "10": 25.1,
          "12": 24.8
        }
      }
    });

    expect(criticalInsight.gapPp2v3).toBe(0.3);
    expect(criticalInsight.statusLevel).toBe("very_tight");
  });
});

describe("getScopeSecondRoundGapVotes", () => {
  it("calcula la brecha proyectada entre rank2 y rank3 para un scope", () => {
    const gap = getScopeSecondRoundGapVotes(
      {
        projectedVotes: {
          "10": 350,
          "12": 310
        }
      },
      "10",
      "12"
    );

    expect(gap).toBe(40);
  });
});
