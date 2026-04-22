import {
  buildComparisonCandidateOptions,
  buildComparisonOthersBar,
  buildSecondRoundInsight,
  buildNationalComparisonItems,
  buildScopeComparisonItem,
  getScopeComparisonGap,
  getScopeSecondRoundGapVotes,
  reconcileComparisonPair,
  resolveDefaultComparisonPair
} from "../src/lib/comparison";
import type { ElectionSnapshot, RegionResult, ScopeResult } from "../src/lib/types";

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

    expect(insight.rank1).toMatchObject({
      code: "8",
      label: "CANDIDATA A",
      projectedVotes: 1200
    });
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

  it("incluye candidatos no destacados para definir 2do y 3ro", () => {
    const insight = buildSecondRoundInsight({
      ...secondRoundSnapshot,
      national: {
        ...secondRoundSnapshot.national,
        actasContabilizadasPct: 80,
        candidates: [
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
            votesValid: 260,
            pctValid: 26,
            pctEmitted: 22
          },
          {
            code: "12",
            partyName: "PARTIDO C",
            candidateName: "CANDIDATA C",
            votesValid: 220,
            pctValid: 22,
            pctEmitted: 19
          },
          {
            code: "21",
            partyName: "PARTIDO D",
            candidateName: "CANDIDATO D",
            votesValid: 250,
            pctValid: 25,
            pctEmitted: 21
          }
        ]
      },
      foreign: {
        ...secondRoundSnapshot.foreign,
        actasContabilizadasPct: 80,
        candidates: [
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
            votesValid: 30,
            pctValid: 15,
            pctEmitted: 12
          },
          {
            code: "12",
            partyName: "PARTIDO C",
            candidateName: "CANDIDATA C",
            votesValid: 20,
            pctValid: 10,
            pctEmitted: 8
          },
          {
            code: "21",
            partyName: "PARTIDO D",
            candidateName: "CANDIDATO D",
            votesValid: 80,
            pctValid: 25,
            pctEmitted: 20
          }
        ]
      },
      projectedNational: {
        totalElectores: 1200,
        totalProjectedValidVotes: 1701,
        projectedVotes: {
          "8": 625,
          "10": 363,
          "12": 300,
          otros: 413
        },
        projectedPercentages: {
          "8": 36.743,
          "10": 21.34,
          "12": 17.637,
          otros: 24.28
        }
      }
    });

    expect(insight.rank2).toMatchObject({
      code: "21",
      label: "CANDIDATO D",
      projectedVotes: 413
    });
    expect(insight.rank3).toMatchObject({
      code: "10",
      label: "CANDIDATO B",
      projectedVotes: 363
    });
    expect(insight.gapVotes2v3).toBe(50);
    expect(insight.gapPp2v3).toBe(2.94);
  });

  it("prioriza la proyección canónica bottom-up para el ranking 2do vs 3ro", () => {
    const regionNorth: RegionResult = {
      ...scope,
      scopeId: "010000",
      kind: "department",
      label: "NORTE",
      actasContabilizadasPct: 100,
      candidates: [
        {
          code: "8",
          partyName: "PARTIDO A",
          candidateName: "CANDIDATA A",
          votesValid: 120,
          pctValid: 54.545,
          pctEmitted: 48
        },
        {
          code: "10",
          partyName: "PARTIDO B",
          candidateName: "CANDIDATO B",
          votesValid: 80,
          pctValid: 36.364,
          pctEmitted: 32
        },
        {
          code: "12",
          partyName: "PARTIDO C",
          candidateName: "CANDIDATA C",
          votesValid: 20,
          pctValid: 9.091,
          pctEmitted: 8
        }
      ],
      projectedVotes: {
        "8": 120,
        "10": 80,
        "12": 20,
        otros: 0
      },
      provinces: []
    };
    const regionSouth: RegionResult = {
      ...scope,
      scopeId: "020000",
      kind: "department",
      label: "SUR",
      actasContabilizadasPct: 10,
      candidates: [
        {
          code: "8",
          partyName: "PARTIDO A",
          candidateName: "CANDIDATA A",
          votesValid: 5,
          pctValid: 33.333,
          pctEmitted: 30
        },
        {
          code: "10",
          partyName: "PARTIDO B",
          candidateName: "CANDIDATO B",
          votesValid: 1,
          pctValid: 6.667,
          pctEmitted: 6
        },
        {
          code: "12",
          partyName: "PARTIDO C",
          candidateName: "CANDIDATA C",
          votesValid: 9,
          pctValid: 60,
          pctEmitted: 54
        }
      ],
      projectedVotes: {
        "8": 50,
        "10": 10,
        "12": 90,
        otros: 0
      },
      provinces: []
    };

    const insight = buildSecondRoundInsight({
      ...secondRoundSnapshot,
      national: {
        ...secondRoundSnapshot.national,
        actasContabilizadasPct: 55,
        candidates: [
          {
            code: "8",
            partyName: "PARTIDO A",
            candidateName: "CANDIDATA A",
            votesValid: 125,
            pctValid: 53.191,
            pctEmitted: 47
          },
          {
            code: "10",
            partyName: "PARTIDO B",
            candidateName: "CANDIDATO B",
            votesValid: 81,
            pctValid: 34.468,
            pctEmitted: 30
          },
          {
            code: "12",
            partyName: "PARTIDO C",
            candidateName: "CANDIDATA C",
            votesValid: 29,
            pctValid: 12.34,
            pctEmitted: 11
          }
        ]
      },
      foreign: {
        ...secondRoundSnapshot.foreign,
        candidates: []
      },
      regions: [regionNorth, regionSouth],
      projectedNational: {
        totalElectores: 1200,
        totalProjectedValidVotes: 370,
        projectedVotes: {
          "8": 170,
          "10": 90,
          "12": 110,
          otros: 0
        },
        projectedPercentages: {
          "8": 45.946,
          "10": 24.324,
          "12": 29.73,
          otros: 0
        }
      },
      featuredCandidateCodes: ["8", "10", "12"]
    });

    expect(insight.rank2).toMatchObject({
      code: "12",
      projectedVotes: 110
    });
    expect(insight.rank3).toMatchObject({
      code: "10",
      projectedVotes: 90
    });
    expect(insight.gapVotes2v3).toBe(20);
    expect(insight.gapPp2v3).toBe(5.406);
  });

  it("usa projectedNational para votos cuando el código está disponible", () => {
    const insight = buildSecondRoundInsight({
      ...secondRoundSnapshot,
      regions: [
        {
          ...scope,
          scopeId: "010000",
          kind: "department",
          label: "NORTE",
          actasContabilizadasPct: 50,
          candidates: [
            {
              code: "8",
              partyName: "PARTIDO A",
              candidateName: "CANDIDATA A",
              votesValid: 100,
              pctValid: 40,
              pctEmitted: 35
            },
            {
              code: "10",
              partyName: "PARTIDO B",
              candidateName: "CANDIDATO B",
              votesValid: 90,
              pctValid: 36,
              pctEmitted: 31
            },
            {
              code: "12",
              partyName: "PARTIDO C",
              candidateName: "CANDIDATA C",
              votesValid: 40,
              pctValid: 16,
              pctEmitted: 14
            }
          ],
          provinces: []
        }
      ],
      foreign: {
        ...secondRoundSnapshot.foreign,
        actasContabilizadasPct: 50,
        candidates: [
          {
            code: "8",
            partyName: "PARTIDO A",
            candidateName: "CANDIDATA A",
            votesValid: 60,
            pctValid: 40,
            pctEmitted: 34
          },
          {
            code: "10",
            partyName: "PARTIDO B",
            candidateName: "CANDIDATO B",
            votesValid: 35,
            pctValid: 23.333,
            pctEmitted: 20
          },
          {
            code: "12",
            partyName: "PARTIDO C",
            candidateName: "CANDIDATA C",
            votesValid: 55,
            pctValid: 36.667,
            pctEmitted: 31
          }
        ]
      },
      projectedNational: {
        totalElectores: 1200,
        totalProjectedValidVotes: 750,
        projectedVotes: {
          "8": 320,
          "10": 210,
          "12": 200,
          otros: 20
        },
        projectedPercentages: {
          "8": 42.667,
          "10": 28,
          "12": 26.667,
          otros: 2.667
        }
      }
    });

    expect(insight.rank2).toMatchObject({
      code: "10",
      projectedVotes: 210
    });
    expect(insight.rank3).toMatchObject({
      code: "12",
      projectedVotes: 200
    });
    expect(insight.gapVotes2v3).toBe(10);
    expect(insight.gapPp2v3).toBe(1.333);
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

  it("usa candidates + actas como fallback cuando projectedVotes no incluye rank2/rank3", () => {
    const gap = getScopeSecondRoundGapVotes(
      {
        projectedVotes: {
          "8": 500,
          "10": 300,
          otros: 200
        },
        actasContabilizadasPct: 80,
        candidates: [
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
            votesValid: 240,
            pctValid: 24,
            pctEmitted: 20
          },
          {
            code: "21",
            partyName: "PARTIDO D",
            candidateName: "CANDIDATO D",
            votesValid: 248,
            pctValid: 24.8,
            pctEmitted: 21
          }
        ]
      },
      "21",
      "10"
    );

    expect(gap).toBe(10);
  });
});

describe("comparison pair helpers", () => {
  it("resuelve el default A/B desde el ranking proyectado 2do vs 3ro", () => {
    const resolution = resolveDefaultComparisonPair(secondRoundSnapshot);

    expect(resolution).toMatchObject({
      pair: {
        candidateACode: "10",
        candidateBCode: "12"
      },
      initSource: "default_rank_2v3",
      status: "initialized"
    });
  });

  it("reconcilia un par cuando uno de los candidatos deja de existir", () => {
    const snapshotWithoutRank3: ElectionSnapshot = {
      ...secondRoundSnapshot,
      national: {
        ...secondRoundSnapshot.national,
        featuredCandidates: secondRoundSnapshot.national.featuredCandidates.filter(
          (candidate) => candidate.code !== "12"
        )
      },
      foreign: {
        ...secondRoundSnapshot.foreign,
        featuredCandidates: secondRoundSnapshot.foreign.featuredCandidates.filter(
          (candidate) => candidate.code !== "12"
        )
      },
      projectedNational: {
        ...secondRoundSnapshot.projectedNational,
        projectedVotes: {
          "8": 1200,
          "10": 780,
          otros: 260
        },
        projectedPercentages: {
          "8": 40,
          "10": 26,
          otros: 8.667
        }
      }
    };

    const resolution = reconcileComparisonPair(snapshotWithoutRank3, {
      candidateACode: "10",
      candidateBCode: "12"
    });

    expect(resolution).toMatchObject({
      pair: {
        candidateACode: "10",
        candidateBCode: "8"
      },
      initSource: "fallback",
      status: "reassigned"
    });
  });

  it("expone opciones seleccionables sin incluir candidatos fantasma", () => {
    const mixedSnapshot: ElectionSnapshot = {
      ...secondRoundSnapshot,
      projectedNational: {
        ...secondRoundSnapshot.projectedNational,
        projectedVotes: {
          ...secondRoundSnapshot.projectedNational.projectedVotes,
          "99": 900
        },
        projectedPercentages: {
          ...secondRoundSnapshot.projectedNational.projectedPercentages,
          "99": 30
        }
      }
    };

    const options = buildComparisonCandidateOptions(mixedSnapshot);

    expect(options.map((candidate) => candidate.code)).not.toContain("99");
  });
});

describe("A/B comparison calculations", () => {
  it("calcula la brecha proyectada y actual entre A y B para un scope", () => {
    const scopeWithThreeCandidates: ScopeResult = {
      ...scope,
      candidates: [
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
        },
        {
          code: "12",
          partyName: "PARTIDO C",
          candidateName: "CANDIDATA C",
          votesValid: 200,
          pctValid: 20,
          pctEmitted: 18
        }
      ],
      featuredCandidates: [
        ...scope.featuredCandidates,
        {
          code: "12",
          partyName: "PARTIDO C",
          candidateName: "CANDIDATA C",
          votesValid: 200,
          pctValid: 20,
          pctEmitted: 18
        }
      ],
      projectedVotes: {
        "8": 500,
        "10": 300,
        "12": 250,
        otros: 100
      }
    };

    const projectedGap = getScopeComparisonGap(
      scopeWithThreeCandidates,
      {
        candidateACode: "10",
        candidateBCode: "12"
      },
      "projected"
    );
    const currentGap = getScopeComparisonGap(
      scopeWithThreeCandidates,
      {
        candidateACode: "10",
        candidateBCode: "12"
      },
      "current"
    );

    expect(projectedGap).toEqual({
      gapVotes: 50,
      gapPercentage: 4.348
    });
    expect(currentGap).toEqual({
      gapVotes: 100,
      gapPercentage: 12.5
    });
  });

  it('excluye del agregado "Otros" a un contendiente seleccionado no destacado', () => {
    const fallbackSnapshot: ElectionSnapshot = {
      ...secondRoundSnapshot,
      national: {
        ...secondRoundSnapshot.national,
        candidates: [
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
          },
          {
            code: "21",
            partyName: "PARTIDO D",
            candidateName: "CANDIDATO D",
            votesValid: 248,
            pctValid: 24.8,
            pctEmitted: 21
          }
        ],
        otros: {
          code: "otros",
          label: "Otros",
          votesValid: 248,
          pctValid: 24.8,
          pctEmitted: 21
        }
      },
      foreign: {
        ...secondRoundSnapshot.foreign,
        totalVotosValidos: 0,
        totalVotosEmitidos: 0,
        candidates: [],
        featuredCandidates: [],
        otros: {
          code: "otros",
          label: "Otros",
          votesValid: 0,
          pctValid: 0,
          pctEmitted: 0
        }
      },
      projectedNational: {
        ...secondRoundSnapshot.projectedNational,
        totalProjectedValidVotes: 1185,
        projectedVotes: {
          "8": 500,
          "10": 375,
          "21": 310,
          otros: 310
        },
        projectedPercentages: {
          "8": 42.194,
          "10": 31.646,
          "21": 26.16,
          otros: 26.16
        }
      }
    };

    const othersBar = buildComparisonOthersBar(fallbackSnapshot, ["10", "21"]);

    expect(othersBar).toBeNull();
  });
});
