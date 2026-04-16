/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import App from "../src/App";
import type {
  ElectionSnapshot,
  ForeignResult,
  RegionResult,
  ScopeResult
} from "../src/lib/types";

const { fetchSnapshotMock, refreshSnapshotMock, initializeAnalyticsMock, trackEventMock, trackInitialPageViewMock } = vi.hoisted(() => ({
  fetchSnapshotMock: vi.fn<() => Promise<ElectionSnapshot>>(),
  refreshSnapshotMock: vi.fn<() => Promise<ElectionSnapshot>>(),
  initializeAnalyticsMock: vi.fn(),
  trackEventMock: vi.fn(),
  trackInitialPageViewMock: vi.fn()
}));

vi.mock("../src/lib/api", () => ({
  fetchSnapshot: fetchSnapshotMock,
  refreshSnapshot: refreshSnapshotMock
}));

vi.mock("../src/lib/analytics", () => ({
  initializeAnalytics: initializeAnalyticsMock,
  trackEvent: trackEventMock,
  trackInitialPageView: trackInitialPageViewMock
}));

function createScope(overrides: Partial<ScopeResult> = {}): ScopeResult {
  return {
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
    sourceUpdatedAt: new Date("2026-04-15T12:00:00.000Z").toISOString(),
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
      "10": 300,
      otros: 200
    },
    ...overrides
  };
}

function createRegion(overrides: Partial<RegionResult>): RegionResult {
  return {
    ...createScope({
      scopeId: "040000",
      kind: "department",
      label: "AREQUIPA",
      electores: 1200,
      padronShare: 4.4,
      projectedVotes: {
        "8": 600,
        "10": 350,
        otros: 250
      }
    }),
    kind: "department",
    provinces: [
      {
        scopeId: "040101",
        parentScopeId: "040000",
        kind: "province",
        label: "AREQUIPA",
        actasContabilizadasPct: 81,
        contabilizadas: 81,
        totalActas: 100,
        participacionCiudadanaPct: 71,
        enviadasJee: 0,
        pendientesJee: 0,
        totalVotosEmitidos: 500,
        totalVotosValidos: 450,
        sourceUpdatedAt: new Date("2026-04-15T12:00:00.000Z").toISOString(),
        candidates: [],
        featuredCandidates: [
          {
            code: "8",
            partyName: "PARTIDO A",
            candidateName: "CANDIDATA A",
            votesValid: 200,
            pctValid: 44.4,
            pctEmitted: 40
          },
          {
            code: "10",
            partyName: "PARTIDO B",
            candidateName: "CANDIDATO B",
            votesValid: 150,
            pctValid: 33.3,
            pctEmitted: 29
          }
        ],
        otros: {
          code: "otros",
          label: "Otros",
          votesValid: 100,
          pctValid: 22.3,
          pctEmitted: 20
        },
        projectedVotes: {
          "8": 247,
          "10": 185,
          otros: 123
        }
      },
      {
        scopeId: "040102",
        parentScopeId: "040000",
        kind: "province",
        label: "CAMANÁ",
        actasContabilizadasPct: 60,
        contabilizadas: 60,
        totalActas: 100,
        participacionCiudadanaPct: 67,
        enviadasJee: 0,
        pendientesJee: 0,
        totalVotosEmitidos: 300,
        totalVotosValidos: 270,
        sourceUpdatedAt: new Date("2026-04-15T12:00:00.000Z").toISOString(),
        candidates: [],
        featuredCandidates: [
          {
            code: "8",
            partyName: "PARTIDO A",
            candidateName: "CANDIDATA A",
            votesValid: 120,
            pctValid: 44.4,
            pctEmitted: 40
          },
          {
            code: "10",
            partyName: "PARTIDO B",
            candidateName: "CANDIDATO B",
            votesValid: 60,
            pctValid: 22.2,
            pctEmitted: 20
          }
        ],
        otros: {
          code: "otros",
          label: "Otros",
          votesValid: 90,
          pctValid: 33.4,
          pctEmitted: 30
        },
        projectedVotes: {
          "8": 200,
          "10": 100,
          otros: 150
        }
      }
    ],
    ...overrides
  };
}

function createForeign(overrides: Partial<ForeignResult> = {}): ForeignResult {
  return {
    ...createScope({
      scopeId: "2",
      kind: "foreign_total",
      label: "EXTRANJERO",
      electores: 200,
      padronShare: 5,
      totalVotosValidos: 150,
      projectedVotes: {
        "8": 120,
        "10": 70,
        otros: 35
      }
    }),
    kind: "foreign_total",
    continents: [
      {
        ...createScope({
          scopeId: "920000",
          kind: "foreign_continent",
          label: "EUROPA",
          electores: 0,
          padronShare: 0,
          totalVotosValidos: 90,
          projectedVotes: {
            "8": 80,
            "10": 45,
            otros: 20
          }
        }),
        kind: "foreign_continent",
        countries: [
          {
            scopeId: "921000",
            parentScopeId: "920000",
            kind: "foreign_country",
            label: "ESPAÑA",
            actasContabilizadasPct: 75,
            contabilizadas: 75,
            totalActas: 100,
            participacionCiudadanaPct: 69,
            enviadasJee: 0,
            pendientesJee: 0,
            totalVotosEmitidos: 120,
            totalVotosValidos: 100,
            sourceUpdatedAt: new Date("2026-04-15T12:00:00.000Z").toISOString(),
            candidates: [],
            featuredCandidates: [
              {
                code: "8",
                partyName: "PARTIDO A",
                candidateName: "CANDIDATA A",
                votesValid: 45,
                pctValid: 45,
                pctEmitted: 37
              },
              {
                code: "10",
                partyName: "PARTIDO B",
                candidateName: "CANDIDATO B",
                votesValid: 25,
                pctValid: 25,
                pctEmitted: 20
              }
            ],
            otros: {
              code: "otros",
              label: "Otros",
              votesValid: 30,
              pctValid: 30,
              pctEmitted: 25
            },
            projectedVotes: {
              "8": 60,
              "10": 33,
              otros: 40
            }
          }
        ]
      },
      {
        ...createScope({
          scopeId: "930000",
          kind: "foreign_continent",
          label: "AMÉRICA",
          electores: 0,
          padronShare: 0,
          totalVotosValidos: 60,
          projectedVotes: {
            "8": 40,
            "10": 25,
            otros: 15
          }
        }),
        kind: "foreign_continent",
        countries: [
          {
            scopeId: "931000",
            parentScopeId: "930000",
            kind: "foreign_country",
            label: "ARGENTINA",
            actasContabilizadasPct: 68,
            contabilizadas: 68,
            totalActas: 100,
            participacionCiudadanaPct: 65,
            enviadasJee: 0,
            pendientesJee: 0,
            totalVotosEmitidos: 90,
            totalVotosValidos: 75,
            sourceUpdatedAt: new Date("2026-04-15T12:00:00.000Z").toISOString(),
            candidates: [],
            featuredCandidates: [
              {
                code: "8",
                partyName: "PARTIDO A",
                candidateName: "CANDIDATA A",
                votesValid: 30,
                pctValid: 40,
                pctEmitted: 33
              },
              {
                code: "10",
                partyName: "PARTIDO B",
                candidateName: "CANDIDATO B",
                votesValid: 22,
                pctValid: 29.3,
                pctEmitted: 24
              }
            ],
            otros: {
              code: "otros",
              label: "Otros",
              votesValid: 23,
              pctValid: 30.7,
              pctEmitted: 26
            },
            projectedVotes: {
              "8": 40,
              "10": 25,
              otros: 15
            }
          }
        ]
      }
    ],
    ...overrides
  };
}

function createSnapshot(): ElectionSnapshot {
  const regionA = createRegion({});
  const regionB = createRegion({
    scopeId: "150000",
    label: "LIMA",
    electores: 900,
    padronShare: 3.3,
    projectedVotes: {
      "8": 450,
      "10": 280,
      otros: 120
    },
    provinces: [
      {
        scopeId: "150101",
        parentScopeId: "150000",
        kind: "province",
        label: "BARRANCA",
        actasContabilizadasPct: 72,
        contabilizadas: 72,
        totalActas: 100,
        participacionCiudadanaPct: 68,
        enviadasJee: 0,
        pendientesJee: 0,
        totalVotosEmitidos: 280,
        totalVotosValidos: 250,
        sourceUpdatedAt: new Date("2026-04-15T12:00:00.000Z").toISOString(),
        candidates: [],
        featuredCandidates: [
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
            votesValid: 80,
            pctValid: 32,
            pctEmitted: 28
          }
        ],
        otros: {
          code: "otros",
          label: "Otros",
          votesValid: 70,
          pctValid: 28,
          pctEmitted: 25
        },
        projectedVotes: {
          "8": 139,
          "10": 111,
          otros: 97
        }
      }
    ]
  });

  return {
    generatedAt: new Date("2026-04-15T12:05:00.000Z").toISOString(),
    sourceElectionId: 10,
    sourceLastUpdatedAt: new Date("2026-04-15T12:00:00.000Z").toISOString(),
    national: createScope(),
    foreign: createForeign(),
    regions: [regionA, regionB],
    projectedNational: {
      totalElectores: 2200,
      totalProjectedValidVotes: 1800,
      projectedVotes: {
        "8": 1100,
        "10": 700,
        otros: 500
      },
      projectedPercentages: {
        "8": 47.826,
        "10": 30.435,
        otros: 21.739
      }
    },
    featuredCandidateCodes: ["8", "10"],
    isStale: false
  };
}

function createLegacySnapshot(): ElectionSnapshot {
  return {
    ...createSnapshot(),
    foreign: createScope({
      scopeId: "2",
      kind: "foreign_total",
      label: "EXTRANJERO",
      electores: 200,
      padronShare: 5,
      totalVotosValidos: 150
    }) as unknown as ElectionSnapshot["foreign"]
  };
}

describe("App hero clarity and first action", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    fetchSnapshotMock.mockResolvedValue(createSnapshot());
    refreshSnapshotMock.mockResolvedValue(createSnapshot());
    initializeAnalyticsMock.mockReset();
    trackEventMock.mockReset();
    trackInitialPageViewMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    fetchSnapshotMock.mockReset();
    refreshSnapshotMock.mockReset();
    initializeAnalyticsMock.mockReset();
    trackEventMock.mockReset();
    trackInitialPageViewMock.mockReset();
  });

  it("renderiza copy de hero y enlaces de primera acción", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Resultados presidenciales 2026");
    expect(container.textContent).toContain("Entiende rápido cómo va el conteo y la proyección nacional");
    expect(container.textContent).toContain(
      "Consulta resultados ONPE, compara candidatos y explora regiones y países con datos actualizados."
    );
    expect(container.textContent).toContain("Actualizamos esta vista con nuevos cortes oficiales de ONPE.");

    const primaryCta = container.querySelector('a[href="#lectura-regional"]');
    const secondaryCta = container.querySelector('a[href="#metodologia"]');
    expect(primaryCta?.textContent).toContain("Explorar regiones");
    expect(secondaryCta?.textContent).toContain("Ver metodología");
    expect(container.querySelector("#lectura-regional")).not.toBeNull();
    expect(container.querySelector("#metodologia")).not.toBeNull();
  });

  it("dispara tracking al hacer click en ambos CTAs del hero", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const primaryCta = container.querySelector('a[href="#lectura-regional"]') as HTMLAnchorElement;
    const secondaryCta = container.querySelector('a[href="#metodologia"]') as HTMLAnchorElement;
    expect(primaryCta).not.toBeNull();
    expect(secondaryCta).not.toBeNull();

    trackEventMock.mockClear();

    await act(async () => {
      primaryCta.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      secondaryCta.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trackEventMock).toHaveBeenCalledWith("hero_primary_cta_click", {
      location: "hero",
      label: "explorar_regiones",
      section_target: "lectura_regional"
    });
    expect(trackEventMock).toHaveBeenCalledWith("hero_secondary_cta_click", {
      location: "hero",
      label: "ver_metodologia",
      section_target: "metodologia"
    });
  });
});

describe("App province drilldown", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    fetchSnapshotMock.mockResolvedValue(createSnapshot());
    refreshSnapshotMock.mockResolvedValue(createSnapshot());
    initializeAnalyticsMock.mockReset();
    trackEventMock.mockReset();
    trackInitialPageViewMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    fetchSnapshotMock.mockReset();
    refreshSnapshotMock.mockReset();
    initializeAnalyticsMock.mockReset();
    trackEventMock.mockReset();
    trackInitialPageViewMock.mockReset();
  });

  it("mantiene provincias colapsadas al inicio y permite abrir una sola región a la vez", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Tabla de 25 regiones");
    expect(container.textContent).not.toContain("Detalle provincial");
    expect(container.textContent).not.toContain("CAMANÁ");
    expect(container.textContent).not.toContain("BARRANCA");

    const firstRegionButton = Array.from(container.querySelectorAll("button.region-row-toggle")).find(
      (button) => button.closest("tr")?.textContent?.includes("AREQUIPA")
    ) as HTMLButtonElement;

    await act(async () => {
      firstRegionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Detalle provincial");
    expect(container.textContent).toContain("CAMANÁ");
    expect(container.textContent).not.toContain("BARRANCA");

    const secondRegionButton = Array.from(container.querySelectorAll("button.region-row-toggle")).find(
      (button) => button.closest("tr")?.textContent?.includes("LIMA")
    ) as HTMLButtonElement;

    await act(async () => {
      secondRegionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("BARRANCA");
    expect(container.textContent).not.toContain("CAMANÁ");
  });

  it("mantiene países colapsados al inicio y permite abrir un solo continente a la vez", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Tabla de continentes y países");
    expect(container.textContent).not.toContain("Detalle por país");
    expect(container.textContent).not.toContain("ESPAÑA");
    expect(container.textContent).not.toContain("ARGENTINA");

    const firstContinentButton = Array.from(container.querySelectorAll("button.region-row-toggle")).find(
      (button) => button.closest("tr")?.textContent?.includes("EUROPA")
    ) as HTMLButtonElement;

    await act(async () => {
      firstContinentButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Detalle por país");
    expect(container.textContent).toContain("ESPAÑA");
    expect(container.textContent).not.toContain("ARGENTINA");

    const secondContinentButton = Array.from(container.querySelectorAll("button.region-row-toggle")).find(
      (button) => button.closest("tr")?.textContent?.includes("AMÉRICA")
    ) as HTMLButtonElement;

    await act(async () => {
      secondContinentButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("ARGENTINA");
    expect(container.textContent).not.toContain("ESPAÑA");
  });

  it("tolera snapshots legacy sin continentes en extranjero", async () => {
    fetchSnapshotMock.mockResolvedValue(createLegacySnapshot());
    refreshSnapshotMock.mockResolvedValue(createLegacySnapshot());

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Peruanos en el extranjero");
    expect(container.textContent).toContain("Tabla de continentes y países");
    expect(container.textContent).not.toContain("Detalle por país");
  });
});
