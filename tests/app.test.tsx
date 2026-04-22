/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import App from "../src/App";
import { formatDateTime } from "../src/lib/format";
import type {
  ElectionSnapshot,
  ForeignResult,
  HealthStatus,
  RegionResult,
  ScopeResult
} from "../src/lib/types";

const {
  fetchSnapshotMock,
  refreshSnapshotMock,
  initializeAnalyticsMock,
  trackEventMock,
  trackInitialPageViewMock
} = vi.hoisted(() => ({
  fetchSnapshotMock: vi.fn(),
  refreshSnapshotMock: vi.fn(),
  initializeAnalyticsMock: vi.fn(),
  trackEventMock: vi.fn(),
  trackInitialPageViewMock: vi.fn()
}));

vi.mock("../src/lib/api", () => ({
  fetchAppData: fetchSnapshotMock,
  refreshAppData: refreshSnapshotMock
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
      "12": 250,
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
        "12": 310,
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
          "12": 140,
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
          "12": 80,
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
        "12": 58,
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
            "12": 38,
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
              "12": 28,
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
            "12": 22,
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
              "12": 22,
              otros: 15
            }
          }
        ]
      }
    ],
    ...overrides
  };
}

function createSnapshot(overrides: Partial<ElectionSnapshot> = {}): ElectionSnapshot {
  const regionA = createRegion({});
  const regionB = createRegion({
    scopeId: "150000",
    label: "LIMA",
    electores: 900,
    padronShare: 3.3,
    projectedVotes: {
      "8": 450,
      "10": 280,
      "12": 270,
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
          "12": 102,
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
    featuredCandidateCodes: ["8", "10", "12"],
    isStale: false,
    ...overrides
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

function createHealth(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    status: "healthy",
    source: "onpe",
    lastSyncAt: "2026-04-15T12:00:00.000Z",
    lastSuccessAt: "2026-04-15T12:00:00.000Z",
    staleMinutes: 0,
    lastError: null,
    ...overrides
  };
}

function createAppData(
  snapshot: ElectionSnapshot = createSnapshot(),
  healthOverrides: Partial<HealthStatus> = {}
) {
  return {
    snapshot,
    health: createHealth({
      lastSyncAt: snapshot.generatedAt,
      lastSuccessAt: snapshot.generatedAt,
      ...healthOverrides
    })
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
    fetchSnapshotMock.mockResolvedValue(createAppData());
    refreshSnapshotMock.mockResolvedValue(createAppData());
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
    vi.useRealTimers();
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
    expect(container.textContent).toContain("Conteo de votos y proyección nacional");
    expect(container.textContent).toContain(
      "Consulta resultados ONPE, compara candidatos y explora regiones y votos extranjeros con datos actualizados."
    );
    expect(container.textContent).toContain("Actualizamos esta vista con nuevos cortes oficiales de ONPE.");
    expect(container.textContent).toContain("Comparativa rápida de candidatos");
    expect(container.textContent).toContain("Actual ONPE");
    expect(container.textContent).toContain("Proyección total");
    expect(container.textContent).toContain("Candidato B vs Candidata C");
    expect(container.textContent).toContain("Brecha A vs B");
    expect(container.textContent).toContain("Actas Perú:");
    expect(container.textContent).toContain("Actas exterior:");
    expect(container.textContent).toContain("Delta proyección:");
    expect(container.textContent).toContain("Ver comparativa personalizada");
    expect(container.textContent).toContain("Estado de actualización");
    expect(container.textContent).toContain("Última actualización de esta app");
    expect(container.textContent).toContain("Próxima revisión automática");
    expect(container.textContent).toContain("Última publicación ONPE");
    expect(container.textContent).not.toContain("Disputa por el 2do cupo:");

    const globalControls = container.querySelector(".global-controls") as HTMLElement;
    const quickInsights = container.querySelector(".quick-insights") as HTMLElement;
    expect(globalControls).not.toBeNull();
    expect(quickInsights).not.toBeNull();
    expect(globalControls.compareDocumentPosition(quickInsights) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

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
      section_target: "lectura-regional"
    });
    expect(trackEventMock).toHaveBeenCalledWith("hero_secondary_cta_click", {
      location: "hero",
      label: "ver_metodologia",
      section_target: "metodologia"
    });
  });

  it("mantiene la app al dia aunque ONPE no tenga un corte reciente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:42:00.000Z"));
    fetchSnapshotMock.mockResolvedValue(
      createAppData(
        createSnapshot({
          generatedAt: "2026-04-15T12:40:00.000Z",
          sourceLastUpdatedAt: "2026-04-15T12:00:00.000Z"
        }),
        {
          lastSuccessAt: "2026-04-15T12:40:00.000Z"
        }
      )
    );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector("#estado-actualizacion .status-badge")?.textContent).toBe("Al día");
    expect(container.textContent).toContain("ONPE aún no publica un corte más reciente.");
    expect(container.textContent).toContain("hace 2 minutos");
    expect(container.textContent).toContain("hace 42 minutos");
  });

  it("marca stale si el ultimo fetch supera el umbral aunque ONPE sea mas reciente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:55:00.000Z"));
    refreshSnapshotMock.mockRejectedValue(new Error("timeout"));
    fetchSnapshotMock.mockResolvedValue(
      createAppData(
        createSnapshot({
          generatedAt: "2026-04-15T12:00:00.000Z",
          sourceLastUpdatedAt: "2026-04-15T12:40:00.000Z",
          isStale: false
        }),
        {
          lastSuccessAt: "2026-04-15T12:00:00.000Z"
        }
      )
    );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector("#estado-actualizacion .status-badge")?.textContent).toBe(
      "Desactualizado"
    );
    expect(container.textContent).toContain("Última actualización de esta app");
    expect(container.textContent).toContain("hace 55 minutos");
    expect(container.textContent).toContain("hace 15 minutos");
    expect(container.textContent).toContain("Mostramos el último snapshot disponible.");
  });

  it("actualiza la fecha visible cuando termina el refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:06:00.000Z"));
    const initialSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:00:00.000Z"
    });
    const refreshedSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:05:00.000Z",
      sourceLastUpdatedAt: "2026-04-15T12:04:00.000Z"
    });
    fetchSnapshotMock.mockResolvedValue(
      createAppData(initialSnapshot, {
        lastSuccessAt: initialSnapshot.generatedAt
      })
    );
    refreshSnapshotMock.mockResolvedValue(
      createAppData(refreshedSnapshot, {
        lastSuccessAt: refreshedSnapshot.generatedAt
      })
    );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain(formatDateTime(initialSnapshot.generatedAt));

    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Actualizar ahora")
    ) as HTMLButtonElement;

    await act(async () => {
      refreshButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(refreshSnapshotMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("App actualizada correctamente.");
    expect(container.textContent).toContain(formatDateTime(refreshedSnapshot.generatedAt));
  });

  it("mantiene el ultimo snapshot visible cuando falla el refresh manual", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:06:00.000Z"));
    const initialSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:00:00.000Z"
    });
    fetchSnapshotMock.mockResolvedValue(createAppData(initialSnapshot));
    refreshSnapshotMock.mockRejectedValue(new Error("timeout"));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Actualizar ahora")
    ) as HTMLButtonElement;

    await act(async () => {
      refreshButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("No se pudo actualizar. Intenta nuevamente.");
    expect(container.textContent).toContain(formatDateTime(initialSnapshot.generatedAt));
  });

  it("dispara auto-refresh una sola vez por ventana y reinicia tras exito", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:16:00.000Z"));

    fetchSnapshotMock.mockResolvedValue(
      createAppData(
        createSnapshot({
          generatedAt: "2026-04-15T12:00:00.000Z",
          sourceLastUpdatedAt: "2026-04-15T11:58:00.000Z"
        }),
        {
          lastSuccessAt: "2026-04-15T12:00:00.000Z"
        }
      )
    );
    refreshSnapshotMock.mockResolvedValue(
      createAppData(
        createSnapshot({
          generatedAt: "2026-04-15T12:16:00.000Z",
          sourceLastUpdatedAt: "2026-04-15T12:15:00.000Z"
        }),
        {
          lastSuccessAt: "2026-04-15T12:16:00.000Z"
        }
      )
    );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshSnapshotMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(refreshSnapshotMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("hace 1 minuto");
  });

  it("reintenta auto-refresh tras un fallo transitorio en segundo plano", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:16:00.000Z"));

    fetchSnapshotMock.mockResolvedValue(
      createAppData(
        createSnapshot({
          generatedAt: "2026-04-15T12:00:00.000Z",
          sourceLastUpdatedAt: "2026-04-15T11:58:00.000Z"
        }),
        {
          lastSuccessAt: "2026-04-15T12:00:00.000Z"
        }
      )
    );
    refreshSnapshotMock
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(
        createAppData(
          createSnapshot({
            generatedAt: "2026-04-15T12:17:00.000Z",
            sourceLastUpdatedAt: "2026-04-15T12:16:00.000Z"
          }),
          {
            lastSuccessAt: "2026-04-15T12:17:00.000Z"
          }
        )
      );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshSnapshotMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Mostramos el último snapshot disponible.");

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshSnapshotMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain(formatDateTime("2026-04-15T12:17:00.000Z"));
  });

  it("limpia feedback manual despues de una actualizacion automática exitosa", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:14:00.000Z"));

    const initialSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:00:00.000Z",
      sourceLastUpdatedAt: "2026-04-15T11:59:00.000Z"
    });
    const manualSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:05:00.000Z",
      sourceLastUpdatedAt: "2026-04-15T12:04:00.000Z"
    });
    const autoSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:20:00.000Z",
      sourceLastUpdatedAt: "2026-04-15T12:20:00.000Z"
    });

    fetchSnapshotMock.mockResolvedValue(
      createAppData(initialSnapshot, {
        lastSuccessAt: initialSnapshot.generatedAt
      })
    );
    refreshSnapshotMock
      .mockResolvedValueOnce(
        createAppData(manualSnapshot, {
          lastSuccessAt: manualSnapshot.generatedAt
        })
      )
      .mockResolvedValueOnce(
        createAppData(autoSnapshot, {
          lastSuccessAt: autoSnapshot.generatedAt
        })
      );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Actualizar ahora")
    ) as HTMLButtonElement;

    await act(async () => {
      refreshButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("App actualizada correctamente.");

    await act(async () => {
      vi.setSystemTime(new Date("2026-04-15T12:20:00.000Z"));
      vi.advanceTimersByTime(6 * 60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshSnapshotMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("App actualizada correctamente.");
    expect(container.textContent).toContain("La app está al día.");
  });

  it("aplica defaults A/B y permite cambiar la comparación personalizada", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const candidateASelect = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    const candidateBSelect = container.querySelector('select[aria-label="Candidato B"]') as HTMLSelectElement;
    const othersButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Off"
    ) as HTMLButtonElement;

    expect(candidateASelect.value).toBe("10");
    expect(candidateBSelect.value).toBe("12");
    expect(othersButton).not.toBeNull();
    expect(othersButton.className).not.toContain("is-active");

    trackEventMock.mockClear();

    await act(async () => {
      candidateASelect.value = "8";
      candidateASelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(candidateASelect.value).toBe("8");
    expect(trackEventMock).toHaveBeenCalledWith(
      "comparison_candidate_change",
      expect.objectContaining({
        candidate_a_code: "8",
        candidate_b_code: "12"
      })
    );
  });

  it("CTA de quick insights conserva A/B y fuerza comparación proyectada", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const candidateASelect = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    const comparisonSelect = container.querySelector('select[aria-label="Comparar"]') as HTMLSelectElement;

    await act(async () => {
      candidateASelect.value = "8";
      candidateASelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      comparisonSelect.value = "current";
      comparisonSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    trackEventMock.mockClear();

    const quickInsightCta = container.querySelector(
      'a.quick-insights__cta[href="#comparativa-central"]'
    ) as HTMLAnchorElement;

    await act(async () => {
      quickInsightCta.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(candidateASelect.value).toBe("8");
    expect(comparisonSelect.value).toBe("projected");
    expect(trackEventMock).toHaveBeenCalledWith(
      "global_control_change",
      expect.objectContaining({
        control_name: "comparison_mode",
        source: "quick_insight_cta"
      })
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      "quick_insight_detail_cta_click",
      expect.objectContaining({
        target_mode: "comparison_pair"
      })
    );
  });

  it("bloquea seleccionar el mismo candidato en A y B y muestra validación inline", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const candidateASelect = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    const candidateBSelect = container.querySelector('select[aria-label="Candidato B"]') as HTMLSelectElement;
    expect(candidateASelect.value).toBe("10");
    expect(candidateBSelect.value).toBe("12");

    await act(async () => {
      candidateASelect.value = "12";
      candidateASelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(candidateASelect.value).toBe("10");
    expect(candidateASelect.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Selecciona dos candidatos distintos.");
    expect(trackEventMock).toHaveBeenCalledWith(
      "comparison_validation_error",
      expect.objectContaining({
        candidate_a_code: "12",
        candidate_b_code: "12"
      })
    );
  });

  it("muestra filtros móviles como overlay sticky sin empujar el layout", async () => {
    const originalInnerWidth = window.innerWidth;

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const globalControls = container.querySelector(".global-controls") as HTMLElement;
    expect(globalControls).not.toBeNull();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390
    });

    Object.defineProperty(globalControls, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 24,
          left: 0,
          right: 390,
          bottom: 80,
          width: 390,
          height: 56
        } as DOMRect)
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    const mobileToggle = container.querySelector(".global-controls__mobile-toggle") as HTMLButtonElement;
    const mobileSummary = container.querySelector(".global-controls__mobile-summary");

    expect(mobileSummary).not.toBeNull();
    expect(mobileToggle).not.toBeNull();
    expect(container.querySelector(".global-controls__mobile-overlay")).toBeNull();

    await act(async () => {
      mobileToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(".global-controls__mobile-overlay")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      mobileToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(".global-controls__mobile-overlay")).toBeNull();
    expect(document.body.style.overflow).toBe("");

    Object.defineProperty(globalControls, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 0,
          left: 0,
          right: 390,
          bottom: 56,
          width: 390,
          height: 56
        } as DOMRect)
    });

    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(container.querySelector(".global-controls__mobile-summary")).not.toBeNull();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth
    });
  });

  it("registra impresión de controles con el par A/B activo", async () => {
    const snapshotWithoutRank3 = createSnapshot();
    snapshotWithoutRank3.national.featuredCandidates =
      snapshotWithoutRank3.national.featuredCandidates.slice(0, 2);
    snapshotWithoutRank3.foreign.featuredCandidates =
      snapshotWithoutRank3.foreign.featuredCandidates.slice(0, 2);
    snapshotWithoutRank3.projectedNational = {
      ...snapshotWithoutRank3.projectedNational,
      projectedVotes: {
        "8": 1200,
        "10": 900,
        otros: 400
      },
      projectedPercentages: {
        "8": 48,
        "10": 36,
        otros: 16
      }
    };
    snapshotWithoutRank3.featuredCandidateCodes = ["8", "10"];

    fetchSnapshotMock.mockResolvedValue(createAppData(snapshotWithoutRank3));
    refreshSnapshotMock.mockResolvedValue(createAppData(snapshotWithoutRank3));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(trackEventMock).toHaveBeenCalledWith(
      "global_controls_impression",
      expect.objectContaining({
        candidate_a_code: "8",
        candidate_b_code: "10",
        comparison_mode: "projected",
        show_others: false,
        snapshot_generated_at: snapshotWithoutRank3.generatedAt
      })
    );
  });

  it("mantiene el CTA de quick insights en modo personalizado cuando falta rank3", async () => {
    const snapshotWithoutRank3 = createSnapshot();
    snapshotWithoutRank3.national.featuredCandidates =
      snapshotWithoutRank3.national.featuredCandidates.slice(0, 2);
    snapshotWithoutRank3.foreign.featuredCandidates =
      snapshotWithoutRank3.foreign.featuredCandidates.slice(0, 2);
    snapshotWithoutRank3.projectedNational = {
      ...snapshotWithoutRank3.projectedNational,
      projectedVotes: {
        "8": 1200,
        "10": 900,
        otros: 400
      },
      projectedPercentages: {
        "8": 48,
        "10": 36,
        otros: 16
      }
    };
    snapshotWithoutRank3.featuredCandidateCodes = ["8", "10"];

    fetchSnapshotMock.mockResolvedValue(createAppData(snapshotWithoutRank3));
    refreshSnapshotMock.mockResolvedValue(createAppData(snapshotWithoutRank3));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const candidateASelect = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    const comparisonSelect = container.querySelector('select[aria-label="Comparar"]') as HTMLSelectElement;
    const quickInsightCta = container.querySelector(
      'a.quick-insights__cta[href="#comparativa-central"]'
    ) as HTMLAnchorElement;

    expect(quickInsightCta.textContent).toContain("Ver comparativa personalizada");

    trackEventMock.mockClear();

    await act(async () => {
      quickInsightCta.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(candidateASelect.value).toBe("8");
    expect(comparisonSelect.value).toBe("projected");
    expect(trackEventMock).toHaveBeenCalledWith(
      "quick_insight_detail_cta_click",
      expect.objectContaining({
        target_mode: "comparison_pair"
      })
    );
  });

  it("conserva la selección A/B cuando llega un snapshot nuevo con el mismo catálogo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:06:00.000Z"));
    const initialSnapshot = createSnapshot();
    const refreshedSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:10:00.000Z"
    });

    fetchSnapshotMock.mockResolvedValue(
      createAppData(initialSnapshot, {
        lastSuccessAt: initialSnapshot.generatedAt
      })
    );
    refreshSnapshotMock.mockResolvedValue(
      createAppData(refreshedSnapshot, {
        lastSuccessAt: refreshedSnapshot.generatedAt
      })
    );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const candidateASelect = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Actualizar ahora")
    ) as HTMLButtonElement;

    await act(async () => {
      candidateASelect.value = "8";
      candidateASelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      refreshButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(candidateASelect.value).toBe("8");
    expect(container.textContent).not.toContain("Actualizamos la comparación con el mejor candidato disponible.");
  });

  it("reubica el candidato faltante cuando cambia el snapshot y muestra un ajuste automático", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:06:00.000Z"));
    const initialSnapshot = createSnapshot();
    const refreshedSnapshot = createSnapshot({
      generatedAt: "2026-04-15T12:10:00.000Z"
    });
    refreshedSnapshot.national.featuredCandidates = refreshedSnapshot.national.featuredCandidates.filter(
      (candidate) => candidate.code !== "12"
    );
    refreshedSnapshot.foreign.featuredCandidates = refreshedSnapshot.foreign.featuredCandidates.filter(
      (candidate) => candidate.code !== "12"
    );
    refreshedSnapshot.projectedNational = {
      ...refreshedSnapshot.projectedNational,
      projectedVotes: {
        "8": 1200,
        "10": 900,
        otros: 400
      },
      projectedPercentages: {
        "8": 48,
        "10": 36,
        otros: 16
      }
    };

    fetchSnapshotMock.mockResolvedValue(
      createAppData(initialSnapshot, {
        lastSuccessAt: initialSnapshot.generatedAt
      })
    );
    refreshSnapshotMock.mockResolvedValue(
      createAppData(refreshedSnapshot, {
        lastSuccessAt: refreshedSnapshot.generatedAt
      })
    );

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const candidateASelect = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    const candidateBSelect = container.querySelector('select[aria-label="Candidato B"]') as HTMLSelectElement;
    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Actualizar ahora")
    ) as HTMLButtonElement;

    expect(candidateASelect.value).toBe("10");
    expect(candidateBSelect.value).toBe("12");

    await act(async () => {
      refreshButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(candidateASelect.value).toBe("10");
    expect(candidateBSelect.value).toBe("8");
    expect(container.textContent).toContain("Actualizamos la comparación con el mejor candidato disponible.");
  });

  it("aplica búsqueda local en regiones y exterior", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const regionSearch = container.querySelector('input[placeholder="Ej. Arequipa"]') as HTMLInputElement;
    const foreignSearch = container.querySelector(
      'input[placeholder="Ej. Europa o España"]'
    ) as HTMLInputElement;

    await act(async () => {
      regionSearch.value = "lima";
      regionSearch.dispatchEvent(new Event("input", { bubbles: true }));
      regionSearch.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("LIMA");
    expect(container.textContent).not.toContain("AREQUIPA");

    await act(async () => {
      foreignSearch.value = "europa";
      foreignSearch.dispatchEvent(new Event("input", { bubbles: true }));
      foreignSearch.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("EUROPA");
    expect(container.textContent).not.toContain("AMÉRICA");
  });

  it("reordena continentes al cambiar ordenar por electores", async () => {
    const snapshot = createSnapshot();
    snapshot.foreign.continents = snapshot.foreign.continents.map((continent) =>
      continent.label === "EUROPA"
        ? {
            ...continent,
            electores: 120,
            projectedVotes: {
              ...continent.projectedVotes,
              "8": 54,
              "10": 50
            }
          }
        : {
            ...continent,
            electores: 480,
            projectedVotes: {
              ...continent.projectedVotes,
              "8": 130,
              "10": 40
            }
          }
    );

    fetchSnapshotMock.mockResolvedValue(createAppData(snapshot));
    refreshSnapshotMock.mockResolvedValue(createAppData(snapshot));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const exteriorSection = container.querySelector("#lectura-exterior") as HTMLElement;
    const getVisibleContinents = () =>
      Array.from(
        exteriorSection.querySelectorAll("tbody > tr.results-table__row > td[data-label=\"Continente\"] strong")
      ).map((node) => node.textContent);

    expect(getVisibleContinents().slice(0, 2)).toEqual(["EUROPA", "AMÉRICA"]);

    const sortSelect = Array.from(container.querySelectorAll("select")).find((select) =>
      select.parentElement?.textContent?.includes("Ordenar por")
    ) as HTMLSelectElement;

    await act(async () => {
      sortSelect.value = "electores";
      sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(getVisibleContinents().slice(0, 2)).toEqual(["AMÉRICA", "EUROPA"]);
  });

  it("actualiza el tracking al cambiar el candidato B desde la barra global", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const candidateBSelect = container.querySelector('select[aria-label="Candidato B"]') as HTMLSelectElement;

    await act(async () => {
      candidateBSelect.value = "8";
      candidateBSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(trackEventMock).toHaveBeenCalledWith(
      "comparison_candidate_change",
      expect.objectContaining({
        candidate_a_code: "10",
        candidate_b_code: "8"
      })
    );
  });

  it("registra impresión del módulo quick insights con el par A/B activo", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(trackEventMock).toHaveBeenCalledWith(
      "quick_insights_impression",
      expect.objectContaining({
        candidate_a_code: "10",
        candidate_b_code: "12",
        candidate_a_label: "Candidato B",
        candidate_b_label: "Candidata C",
        projected_gap_votes: 20
      })
    );
  });

  it("muestra la brecha A vs B dentro del resumen rápido", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const quickInsights = container.querySelector(".quick-insights") as HTMLElement;

    expect(quickInsights.textContent).toContain("Brecha A vs B");
    expect(quickInsights.textContent).toContain("+0.67 pp");
    expect(quickInsights.textContent).toContain("+20 votos");
    expect(quickInsights.textContent).toContain("Ajustado");
    expect(quickInsights.querySelectorAll(".quick-insights__candidate-swatch").length).toBeGreaterThan(0);
    expect(quickInsights.querySelectorAll(".quick-insight-kpi__delta-badge.is-negative").length).toBe(2);
  });

  it("actualiza el resumen rápido cuando cambia el par A/B", async () => {
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      const candidateASelect = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
      candidateASelect.value = "8";
      candidateASelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Actas Perú:");
    expect(container.textContent).toContain("Candidata A vs Candidata C");
  });

  it("evita mezclar fuentes full+featured en el resumen actual cuando snapshot es mixto", async () => {
    const mixedSnapshot = createSnapshot();
    mixedSnapshot.national.candidates = [
      {
        code: "8",
        partyName: "PARTIDO A",
        candidateName: "CANDIDATA A",
        votesValid: 400,
        pctValid: 40,
        pctEmitted: 35
      },
      {
        code: "99",
        partyName: "PARTIDO Z",
        candidateName: "CANDIDATO FANTASMA",
        votesValid: 390,
        pctValid: 39,
        pctEmitted: 34
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
    ];
    mixedSnapshot.foreign.candidates = [];

    fetchSnapshotMock.mockResolvedValue(createAppData(mixedSnapshot));
    refreshSnapshotMock.mockResolvedValue(createAppData(mixedSnapshot));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Candidato Fantasma");
    expect(container.textContent).toContain("Candidato B");
  });

  it("usa el mejor par disponible y comunica fallback cuando falta el rank3 seleccionable", async () => {
    const fallbackSnapshot = createSnapshot();
    fallbackSnapshot.national.candidates = [
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
    ];
    fallbackSnapshot.projectedNational = {
      ...fallbackSnapshot.projectedNational,
      projectedVotes: {
        "8": 1200,
        "10": 780,
        "21": 760,
        otros: 260
      },
      projectedPercentages: {
        "8": 40,
        "10": 26,
        "21": 25.333,
        otros: 8.667
      }
    };
    fallbackSnapshot.regions = [
      createRegion({
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
            votesValid: 280,
            pctValid: 28,
            pctEmitted: 25
          },
          {
            code: "21",
            partyName: "PARTIDO D",
            candidateName: "CANDIDATO D",
            votesValid: 320,
            pctValid: 32,
            pctEmitted: 28
          }
        ],
        projectedVotes: {
          "8": 600,
          "10": 350,
          "12": 310,
          otros: 250
        }
      })
    ];

    fetchSnapshotMock.mockResolvedValue(createAppData(fallbackSnapshot));
    refreshSnapshotMock.mockResolvedValue(createAppData(fallbackSnapshot));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const featuredBars = container.querySelector(".featured-bars");

    expect(container.textContent).toContain("Ajustamos la comparación al mejor par disponible.");
    expect(featuredBars?.textContent).toContain("Candidato B");
    expect(featuredBars?.textContent).toContain("Candidata A");
    expect(featuredBars?.textContent).not.toContain("Candidato D");
  });

  it('excluye contendores 2do vs 3ro no featured del agregado "Otros" en la comparativa central', async () => {
    const fallbackSnapshot = createSnapshot();
    fallbackSnapshot.national.candidates = [
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
    ];
    fallbackSnapshot.national.otros = {
      code: "otros",
      label: "Otros",
      votesValid: 248,
      pctValid: 24.8,
      pctEmitted: 21
    };
    fallbackSnapshot.foreign = {
      ...fallbackSnapshot.foreign,
      totalVotosValidos: 0,
      totalVotosEmitidos: 0,
      candidates: fallbackSnapshot.foreign.featuredCandidates.map((candidate) => ({ ...candidate })),
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
      },
      continents: []
    };
    fallbackSnapshot.projectedNational = {
      ...fallbackSnapshot.projectedNational,
      totalProjectedValidVotes: 1185,
      projectedVotes: {
        "8": 500,
        "10": 375,
        otros: 310
      },
      projectedPercentages: {
        "8": 42.194,
        "10": 31.646,
        otros: 26.16
      }
    };

    fetchSnapshotMock.mockResolvedValue(createAppData(fallbackSnapshot));
    refreshSnapshotMock.mockResolvedValue(createAppData(fallbackSnapshot));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const othersButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.trim() === "Off"
    ) as HTMLButtonElement;

    await act(async () => {
      othersButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const featuredBars = container.querySelectorAll(".featured-bar");
    const featuredBarsText = Array.from(featuredBars)
      .map((bar) => bar.textContent ?? "")
      .join(" ");

    expect(featuredBars).toHaveLength(2);
    expect(featuredBarsText).toContain("Candidato B");
    expect(featuredBarsText).toContain("Candidato D");
    expect(featuredBarsText).not.toContain("Otros");
  });

  it("muestra estado no disponible cuando no hay 3 candidatos para el corte", async () => {
    const snapshotWithoutRank3 = createSnapshot();
    snapshotWithoutRank3.national.featuredCandidates =
      snapshotWithoutRank3.national.featuredCandidates.slice(0, 2);
    snapshotWithoutRank3.foreign.featuredCandidates =
      snapshotWithoutRank3.foreign.featuredCandidates.slice(0, 2);
    snapshotWithoutRank3.projectedNational = {
      ...snapshotWithoutRank3.projectedNational,
      projectedVotes: {
        "8": 1200,
        "10": 900,
        otros: 400
      },
      projectedPercentages: {
        "8": 48,
        "10": 36,
        otros: 16
      }
    };
    snapshotWithoutRank3.featuredCandidateCodes = ["8", "10"];

    fetchSnapshotMock.mockResolvedValue(createAppData(snapshotWithoutRank3));
    refreshSnapshotMock.mockResolvedValue(createAppData(snapshotWithoutRank3));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Ajustamos la comparación al mejor par disponible.");
    expect(container.textContent).toContain("Candidata A vs Candidato B");
    const sortSelect = Array.from(container.querySelectorAll("select")).find((select) =>
      select.parentElement?.textContent?.includes("Ordenar por")
    ) as HTMLSelectElement;
    const sortOptions = Array.from(sortSelect.options).map((option) => option.value);

    expect(sortSelect.value).toBe("gap_2v3");
    expect(sortOptions).toContain("gap_2v3");
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
    fetchSnapshotMock.mockResolvedValue(createAppData());
    refreshSnapshotMock.mockResolvedValue(createAppData());
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
    fetchSnapshotMock.mockResolvedValue(createAppData(createLegacySnapshot()));
    refreshSnapshotMock.mockResolvedValue(createAppData(createLegacySnapshot()));

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Comparativa rápida de candidatos");
    expect(container.textContent).toContain("Tabla de continentes y países");
    expect(container.textContent).not.toContain("Detalle por país");
  });
});
