import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { fetchSnapshot, refreshSnapshot } from "./lib/api";
import { initializeAnalytics, trackEvent, trackInitialPageView } from "./lib/analytics";
import {
  buildNationalComparisonItems,
  buildScopeComparisonItem,
  type ComparisonItem,
  type ComparisonMode
} from "./lib/comparison";
import { getCandidateColor } from "./lib/constants";
import {
  formatCompactNumber,
  formatDateTime,
  getElapsedMinutes,
  formatNumber,
  formatPercent,
  formatRelativeMinutes,
  formatSignedDecimal,
  formatSignedNumber,
  formatTitleCase
} from "./lib/format";
import type {
  ElectionSnapshot,
  ForeignContinentResult,
  ForeignCountryResult,
  ProvinceResult,
  RegionResult,
  ScopeResult
} from "./lib/types";

type SortKey = "electores" | "actas" | "participacion" | "candidate" | "projection";
type LeafScopeResult = ProvinceResult | ForeignCountryResult;

function CandidatePill({
  code,
  label,
  active,
  onClick
}: {
  code: string;
  label: string;
  active: boolean;
  onClick: (code: string) => void;
}) {
  return (
    <button
      className={`candidate-pill ${active ? "is-active" : ""}`}
      onClick={() => onClick(code)}
      style={{ ["--candidate-color" as string]: getCandidateColor(code) }}
      type="button"
    >
      <span className="candidate-pill__dot" />
      {formatTitleCase(label)}
    </button>
  );
}

function FeaturedBar({
  item
}: {
  item: ComparisonItem;
}) {
  const color = getCandidateColor(item.code);

  return (
    <article className="featured-bar">
      <div className="featured-bar__header">
        <div>
          <strong>{formatTitleCase(item.label)}</strong>
          <small>Actual total ONPE vs Proyectado total</small>
        </div>
        <strong className="featured-bar__delta-badge">
          {formatSignedDecimal(item.deltaPercentage, 2)} pp
        </strong>
      </div>

      <div className="featured-bar__tracks">
        <div className="featured-bar__track-meta">
          <span>Actual total ONPE</span>
          <strong>{formatPercent(item.actualPercentage, 2)}</strong>
        </div>
        <div className="featured-bar__track featured-bar__track--overlay">
          <div
            className="featured-bar__fill featured-bar__fill--actual"
            style={{
              width: `${Math.max(item.actualPercentage, 0.5)}%`,
              background: color
            }}
          />
          <div
            className="featured-bar__fill featured-bar__fill--projected"
            style={{
              width: `${Math.max(item.projectedPercentage, 0.5)}%`,
              background: color
            }}
          />
        </div>
        <div className="featured-bar__track-meta">
          <span>Proyectado</span>
          <strong>{formatPercent(item.projectedPercentage, 2)}</strong>
        </div>
      </div>

      <div className="featured-bar__stats">
        <div className="featured-bar__stat">
          <span>Actual total ONPE</span>
          <strong>{formatPercent(item.actualPercentage, 2)}</strong>
          <small>{formatNumber(item.actualVotes)} votos</small>
        </div>
        <div className="featured-bar__stat">
          <span>Proyectado</span>
          <strong>{formatPercent(item.projectedPercentage, 2)}</strong>
          <small>{formatNumber(item.projectedVotes)} votos</small>
        </div>
        <div className="featured-bar__stat featured-bar__stat--delta">
          <span>Delta</span>
          <strong>{formatSignedDecimal(item.deltaPercentage, 2)} pp</strong>
          <small>{formatSignedNumber(item.deltaVotes)} votos</small>
        </div>
      </div>
    </article>
  );
}

function ScopeCard({
  title,
  subtitle,
  scope
}: {
  title: string;
  subtitle: string;
  scope: ScopeResult;
}) {
  return (
    <section className="scope-card">
      <p className="eyebrow">{subtitle}</p>
      <h2>{title}</h2>
      <dl className="scope-card__metrics">
        <div>
          <dt>Actas contabilizadas</dt>
          <dd>{formatPercent(scope.actasContabilizadasPct, 2)}</dd>
        </div>
        <div>
          <dt>Participación</dt>
          <dd>{formatPercent(scope.participacionCiudadanaPct, 2)}</dd>
        </div>
        <div>
          <dt>Electores</dt>
          <dd>{formatCompactNumber(scope.electores)}</dd>
        </div>
        <div>
          <dt>Votos válidos</dt>
          <dd>{formatCompactNumber(scope.totalVotosValidos)}</dd>
        </div>
      </dl>
    </section>
  );
}

function CandidateStack({
  scope,
  showOthers
}: {
  scope: ScopeResult | ProvinceResult | ForeignCountryResult;
  showOthers: boolean;
}) {
  return (
    <div className="mini-stack">
      {scope.featuredCandidates.map((candidate) => (
        <div key={candidate.code} className="mini-stack__row">
          <span
            className="mini-stack__swatch"
            style={{
              background: getCandidateColor(candidate.code)
            }}
          />
          <span>{formatTitleCase(candidate.candidateName)}</span>
          <strong>{formatPercent(candidate.pctValid, 2)}</strong>
        </div>
      ))}

      {showOthers ? (
        <div className="mini-stack__row">
          <span
            className="mini-stack__swatch"
            style={{
              background: getCandidateColor("otros")
            }}
          />
          <span>Otros</span>
          <strong>{formatPercent(scope.otros.pctValid, 2)}</strong>
        </div>
      ) : null}
    </div>
  );
}

function sortRegions(regions: RegionResult[], selectedCode: string, sortKey: SortKey) {
  const sorted = [...regions];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "electores":
        return right.electores - left.electores;
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "candidate": {
        const leftCandidate = left.featuredCandidates.find((candidate) => candidate.code === selectedCode);
        const rightCandidate = right.featuredCandidates.find((candidate) => candidate.code === selectedCode);
        return (rightCandidate?.pctValid ?? 0) - (leftCandidate?.pctValid ?? 0);
      }
      case "projection":
        return (right.projectedVotes[selectedCode] ?? 0) - (left.projectedVotes[selectedCode] ?? 0);
      default:
        return 0;
    }
  });

  return sorted;
}

function sortLeafScopes(
  scopes: LeafScopeResult[],
  selectedCode: string,
  comparisonMode: ComparisonMode
) {
  const sorted = [...scopes];

  sorted.sort((left, right) => {
    const leftComparison = buildScopeComparisonItem(left, selectedCode);
    const rightComparison = buildScopeComparisonItem(right, selectedCode);

    if (comparisonMode === "projected") {
      return rightComparison.projectedVotes - leftComparison.projectedVotes;
    }

    return rightComparison.actualVotes - leftComparison.actualVotes;
  });

  return sorted;
}

function sortForeignContinents(
  continents: ForeignContinentResult[],
  selectedCode: string,
  comparisonMode: ComparisonMode
) {
  const sorted = [...continents];

  sorted.sort((left, right) => {
    const leftComparison = buildScopeComparisonItem(left, selectedCode);
    const rightComparison = buildScopeComparisonItem(right, selectedCode);

    if (comparisonMode === "projected") {
      return rightComparison.projectedVotes - leftComparison.projectedVotes;
    }

    return rightComparison.actualVotes - leftComparison.actualVotes;
  });

  return sorted;
}

function LeafScopeDrilldown({
  titleEyebrow,
  scopeLabel,
  itemSingularLabel,
  itemPluralLabel,
  recompositionLabel,
  scopes,
  selectedCode,
  showOthers,
  comparisonMode
}: {
  titleEyebrow: string;
  scopeLabel: string;
  itemSingularLabel: string;
  itemPluralLabel: string;
  recompositionLabel: string;
  scopes: LeafScopeResult[];
  selectedCode: string;
  showOthers: boolean;
  comparisonMode: ComparisonMode;
}) {
  const comparisonLabel =
    comparisonMode === "projected" ? "Proyección seleccionada" : "Actual seleccionado";
  const sortedScopes = sortLeafScopes(scopes, selectedCode, comparisonMode);

  return (
    <section className="province-panel">
      <div className="province-panel__header">
        <div>
          <p className="eyebrow">{titleEyebrow}</p>
          <h3>{scopeLabel}</h3>
        </div>
        <div className="province-panel__meta">
          <strong>
            {scopes.length} {itemPluralLabel}
          </strong>
          <small>{recompositionLabel}</small>
        </div>
      </div>

      <div className="province-grid province-grid--header" aria-hidden="true">
        <span>{itemSingularLabel}</span>
        <span>Actas</span>
        <span>Participación</span>
        <span>{showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"}</span>
        <span>{comparisonLabel}</span>
      </div>

      <div className="province-list">
        {sortedScopes.map((scope) => {
          const selectedComparison = buildScopeComparisonItem(scope, selectedCode);
          const comparisonVotes =
            comparisonMode === "projected"
              ? selectedComparison.projectedVotes
              : selectedComparison.actualVotes;
          const comparisonPercentage =
            comparisonMode === "projected"
              ? selectedComparison.projectedPercentage
              : selectedComparison.actualPercentage;

          return (
            <article key={scope.scopeId} className="province-grid province-card">
              <div className="province-card__cell" data-label={itemSingularLabel}>
                <strong>{scope.label}</strong>
              </div>
              <div className="province-card__cell" data-label="Actas">
                <strong>{formatPercent(scope.actasContabilizadasPct, 2)}</strong>
              </div>
              <div className="province-card__cell" data-label="Participación">
                <strong>{formatPercent(scope.participacionCiudadanaPct, 2)}</strong>
              </div>
              <div
                className="province-card__cell"
                data-label={showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"}
              >
                <CandidateStack scope={scope} showOthers={showOthers} />
              </div>
              <div className="province-card__cell" data-label={comparisonLabel}>
                <div className="comparison-cell">
                  <strong>{formatNumber(comparisonVotes)}</strong>
                  <span>{formatPercent(comparisonPercentage, 2)}</span>
                  <small>
                    {formatTitleCase(selectedComparison.label)} ·{" "}
                    {comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"}
                  </small>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("projection");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [showOthers, setShowOthers] = useState(true);
  const [regionalComparisonMode, setRegionalComparisonMode] =
    useState<ComparisonMode>("projected");
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [expandedContinentId, setExpandedContinentId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const lastAutoRefreshKeyRef = useRef<string | null>(null);
  const foreignContinents = snapshot?.foreign.continents ?? [];

  async function loadSnapshot(background = false) {
    if (background) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
    }

    try {
      const data = background ? await refreshSnapshot() : await fetchSnapshot();
      setSnapshot(data);
      setError(null);
      setRefreshError(null);
    } catch (reason) {
      const message = (reason as Error).message;

      if (background && snapshot) {
        setRefreshError(message);
      } else {
        setError(message);
      }
    } finally {
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    initializeAnalytics();
    trackInitialPageView();

    void loadSnapshot();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setSelectedCode((currentCode) => {
      if (currentCode && snapshot.featuredCandidateCodes.includes(currentCode)) {
        return currentCode;
      }

      return snapshot.featuredCandidateCodes[0] ?? "otros";
    });
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setExpandedRegionId((currentRegionId) => {
      if (currentRegionId && snapshot.regions.some((region) => region.scopeId === currentRegionId)) {
        return currentRegionId;
      }

      return null;
    });
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setExpandedContinentId((currentContinentId) => {
      if (
        currentContinentId &&
        foreignContinents.some((continent) => continent.scopeId === currentContinentId)
      ) {
        return currentContinentId;
      }

      return null;
    });
  }, [foreignContinents, snapshot]);

  const sourceAgeMinutes = snapshot ? getElapsedMinutes(snapshot.sourceLastUpdatedAt, clockNow) : null;

  useEffect(() => {
    if (!snapshot || sourceAgeMinutes === null || loading || refreshing) {
      return;
    }

    if (sourceAgeMinutes !== 16 && sourceAgeMinutes !== 31) {
      return;
    }

    const refreshKey = `${snapshot.sourceLastUpdatedAt}:${sourceAgeMinutes}`;

    if (lastAutoRefreshKeyRef.current === refreshKey) {
      return;
    }

    lastAutoRefreshKeyRef.current = refreshKey;
    void loadSnapshot(true);
  }, [clockNow, loading, refreshing, snapshot, sourceAgeMinutes]);

  const featuredLegend = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.national.featuredCandidates.map((candidate) => ({
      code: candidate.code,
      label: candidate.candidateName
    }));
  }, [snapshot]);

  const sortedRegions = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return sortRegions(snapshot.regions, selectedCode, sortKey);
  }, [selectedCode, snapshot, sortKey]);

  const sortedContinents = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return sortForeignContinents(foreignContinents, selectedCode, regionalComparisonMode);
  }, [foreignContinents, regionalComparisonMode, selectedCode, snapshot]);

  const nationalComparisonItems = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return buildNationalComparisonItems(snapshot);
  }, [snapshot]);

  const featuredComparisonBars = useMemo(
    () => nationalComparisonItems.filter((item) => item.code !== "otros"),
    [nationalComparisonItems]
  );

  const othersBar = snapshot
    ? nationalComparisonItems.find((item) => item.code === "otros") ?? null
    : null;

  const projectedNationalDeltaVotes = snapshot
    ? snapshot.projectedNational.totalProjectedValidVotes -
    (snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos)
    : 0;
  const selectedComparisonLabel =
    regionalComparisonMode === "projected" ? "Proyección seleccionada" : "Actual seleccionado";

  function handleRefreshClick() {
    trackEvent("refresh_snapshot", {
      source: "hero_status"
    });

    void loadSnapshot(true);
  }

  function handleSortChange(nextSortKey: SortKey) {
    setSortKey(nextSortKey);
    trackEvent("change_region_sort", {
      sort_key: nextSortKey
    });
  }

  function handleShowOthersToggle() {
    setShowOthers((currentValue) => {
      const nextValue = !currentValue;

      trackEvent("toggle_others_series", {
        visible: nextValue
      });

      return nextValue;
    });
  }

  function handleRegionalModeChange(nextMode: ComparisonMode) {
    setRegionalComparisonMode(nextMode);
    trackEvent("change_regional_comparison_mode", {
      mode: nextMode
    });
  }

  function handleCandidateSelect(code: string) {
    setSelectedCode(code);
    trackEvent("select_candidate_focus", {
      candidate_code: code
    });
  }

  function handleRegionToggle(regionId: string) {
    setExpandedRegionId((currentRegionId) => {
      const nextRegionId = currentRegionId === regionId ? null : regionId;

      trackEvent("toggle_region_province_drilldown", {
        region_id: regionId,
        expanded: nextRegionId === regionId
      });

      return nextRegionId;
    });
  }

  function handleContinentToggle(continentId: string) {
    setExpandedContinentId((currentContinentId) => {
      const nextContinentId = currentContinentId === continentId ? null : continentId;

      trackEvent("toggle_foreign_country_drilldown", {
        continent_id: continentId,
        expanded: nextContinentId === continentId
      });

      return nextContinentId;
    });
  }

  if (loading) {
    return (
      <main className="page-shell">
        <section className="hero hero--loading">
          <p className="eyebrow">Cargando snapshot</p>
          <h1>Preparando resultados y proyección nacional…</h1>
        </section>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className="page-shell">
        <section className="hero hero--error">
          <p className="eyebrow">Snapshot no disponible</p>
          <h1>No se pudo cargar la publicación ONPE normalizada.</h1>
          <p>{error ?? "Inténtalo nuevamente en unos minutos."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Resultados ONPE + proyección editorial</p>
          <h1>Perú 2026, una lectura pública del conteo y su proyección nacional.</h1>
          <p className="hero__lede">
            Snapshot server-side desde ONPE, con Perú recompuesto por provincias y extranjero
            recompuesto por países para una proyección agregada de votos válidos según avance de
            actas.
          </p>
        </div>

        <div className="hero__status">
          <div>
            <span>Fuente</span>
            <strong>ONPE oficial</strong>
          </div>
          <div>
            <span>Actualizado</span>
            <strong>{formatDateTime(snapshot.generatedAt)}</strong>
          </div>
          <div>
            <span>Fuente ONPE</span>
            <strong>{formatRelativeMinutes(snapshot.sourceLastUpdatedAt, clockNow)}</strong>
          </div>
          <div>
            <div className="status-card__top">
              <div>
                <span>Estado</span>
                <strong className={snapshot.isStale ? "status-badge is-stale" : "status-badge"}>
                  {snapshot.isStale ? "Stale" : "Al día"}
                </strong>
              </div>
              <button
                className={`refresh-button ${refreshing ? "is-loading" : ""}`}
                type="button"
                onClick={handleRefreshClick}
                disabled={refreshing}
              >
                {refreshing ? <span className="refresh-button__spinner" aria-hidden="true" /> : null}
                {refreshing ? "Actualizando..." : "Actualizar datos"}
              </button>
            </div>
            <small className="status-card__note">
              {refreshError ?? "Fuerza una nueva consulta a ONPE."}
            </small>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        <ScopeCard title="Resumen nacional Perú" subtitle="Ámbito nacional" scope={snapshot.national} />
        <ScopeCard
          title="Peruanos en el extranjero"
          subtitle="Ámbito agregado"
          scope={snapshot.foreign}
        />
        <section className="projection-card">
          <p className="eyebrow">Proyección nacional</p>
          <h2>
            {formatNumber(snapshot.projectedNational.totalProjectedValidVotes)} votos válidos
            proyectados
          </h2>
          <p>
            Suma de proyección regional Perú más extranjero recompuesto desde países, extrapolada
            por avance de actas contabilizadas.
          </p>
          <div className="projection-card__comparison">
            <div>
              <span>Actual total ONPE</span>
              <strong>
                {formatNumber(
                  snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos
                )}
              </strong>
            </div>
            <div>
              <span>Proyectado</span>
              <strong>{formatNumber(snapshot.projectedNational.totalProjectedValidVotes)}</strong>
            </div>
            <div>
              <span>Delta</span>
              <strong>{formatSignedNumber(projectedNationalDeltaVotes)}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="content-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Comparativa central</p>
              <h2>Candidatos destacados + Otros, total elección</h2>
            </div>
          </div>

          <div className="featured-bars">
            {featuredComparisonBars.map((item) => (
              <FeaturedBar
                key={item.code}
                item={item}
              />
            ))}

            {showOthers && othersBar ? (
              <FeaturedBar item={othersBar} />
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header panel__header--stack">
            <div>
              <p className="eyebrow">Lectura regional</p>
              <h2>Tabla de 25 regiones</h2>
            </div>

            <div className="controls">
              <label className="control">
                <span>Ordenar por</span>
                <select
                  value={sortKey}
                  onChange={(event) => handleSortChange(event.target.value as SortKey)}
                >
                  <option value="projection">Proyección</option>
                  <option value="candidate">Candidato</option>
                  <option value="electores">Electores</option>
                  <option value="actas">Actas</option>
                  <option value="participacion">Participación</option>
                </select>
              </label>

              <button
                className={`toggle-button ${showOthers ? "is-active" : ""}`}
                type="button"
                onClick={handleShowOthersToggle}
              >
                {showOthers ? "Ocultar Otros" : "Mostrar Otros"}
              </button>

              <div className="control">
                <span>Columna final</span>
                <div className="toggle-group" role="tablist" aria-label="Comparación regional">
                  <button
                    className={`toggle-button ${regionalComparisonMode === "projected" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("projected")}
                  >
                    Proyectado
                  </button>
                  <button
                    className={`toggle-button ${regionalComparisonMode === "current" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("current")}
                  >
                    Actual ONPE
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="candidate-pill-row">
            {featuredLegend.map((candidate) => (
              <CandidatePill
                key={candidate.code}
                code={candidate.code}
                label={candidate.label}
                active={candidate.code === selectedCode}
                onClick={handleCandidateSelect}
              />
            ))}
          </div>

          <div className="table-shell">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Región</th>
                  <th>Electores</th>
                  <th>% padrón</th>
                  <th>Actas</th>
                  <th>Participación</th>
                  <th>{showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"}</th>
                  <th>{selectedComparisonLabel}</th>
                  <th>Provincias</th>
                </tr>
              </thead>
              <tbody>
                {sortedRegions.map((region) => {
                  const selectedComparison = buildScopeComparisonItem(region, selectedCode);
                  const isExpanded = expandedRegionId === region.scopeId;
                  const isProjectedMode = regionalComparisonMode === "projected";
                  const comparisonVotes = isProjectedMode
                    ? selectedComparison.projectedVotes
                    : selectedComparison.actualVotes;
                  const comparisonPercentage = isProjectedMode
                    ? selectedComparison.projectedPercentage
                    : selectedComparison.actualPercentage;

                  return (
                    <Fragment key={region.scopeId}>
                      <tr className={isExpanded ? "results-table__row is-expanded" : "results-table__row"}>
                        <td data-label="Región">
                          <strong>{region.label}</strong>
                        </td>
                        <td data-label="Electores">{formatNumber(region.electores)}</td>
                        <td data-label="% padrón">{formatPercent(region.padronShare, 2)}</td>
                        <td data-label="Actas">{formatPercent(region.actasContabilizadasPct, 2)}</td>
                        <td data-label="Participación">
                          {formatPercent(region.participacionCiudadanaPct, 2)}
                        </td>
                        <td
                          data-label={
                            showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"
                          }
                        >
                          <CandidateStack scope={region} showOthers={showOthers} />
                        </td>
                        <td data-label={selectedComparisonLabel}>
                          <div className="comparison-cell">
                            <strong>{formatNumber(comparisonVotes)}</strong>
                            <span>{formatPercent(comparisonPercentage, 2)}</span>
                            <small>
                              {formatTitleCase(selectedComparison.label)} ·{" "}
                              {isProjectedMode ? "Proyectado" : "Actual ONPE"}
                            </small>
                          </div>
                        </td>
                        <td data-label="Provincias">
                          <button
                            className={`region-row-toggle ${isExpanded ? "is-active" : ""}`}
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={`region-provinces-${region.scopeId}`}
                            aria-label={isExpanded ? `Ocultar provincias de ${region.label}` : `Ver provincias de ${region.label}`}
                            onClick={() => handleRegionToggle(region.scopeId)}
                          >
                            <span className="region-row-toggle__icon" aria-hidden="true">
                              {isExpanded ? "−" : "+"}
                            </span>
                            <span className="region-row-toggle__label">
                              {isExpanded ? "Ocultar provincias" : "Ver provincias"}
                            </span>
                          </button>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="region-detail-row" id={`region-provinces-${region.scopeId}`}>
                          <td colSpan={8}>
                            <LeafScopeDrilldown
                              titleEyebrow="Detalle provincial"
                              scopeLabel={region.label}
                              itemSingularLabel="Provincia"
                              itemPluralLabel="provincias"
                              recompositionLabel="La proyección regional se recompone desde sus provincias"
                              scopes={region.provinces}
                              selectedCode={selectedCode}
                              showOthers={showOthers}
                              comparisonMode={regionalComparisonMode}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header panel__header--stack">
            <div>
              <p className="eyebrow">Lectura exterior</p>
              <h2>Tabla de continentes y países</h2>
            </div>

            <div className="controls">
              <button
                className={`toggle-button ${showOthers ? "is-active" : ""}`}
                type="button"
                onClick={handleShowOthersToggle}
              >
                {showOthers ? "Ocultar Otros" : "Mostrar Otros"}
              </button>

              <div className="control">
                <span>Columna final</span>
                <div className="toggle-group" role="tablist" aria-label="Comparación extranjero">
                  <button
                    className={`toggle-button ${regionalComparisonMode === "projected" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("projected")}
                  >
                    Proyectado
                  </button>
                  <button
                    className={`toggle-button ${regionalComparisonMode === "current" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("current")}
                  >
                    Actual ONPE
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="candidate-pill-row">
            {featuredLegend.map((candidate) => (
              <CandidatePill
                key={`foreign-${candidate.code}`}
                code={candidate.code}
                label={candidate.label}
                active={candidate.code === selectedCode}
                onClick={handleCandidateSelect}
              />
            ))}
          </div>

          <div className="table-shell">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Continente</th>
                  <th>Actas</th>
                  <th>Participación</th>
                  <th>{showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"}</th>
                  <th>{selectedComparisonLabel}</th>
                  <th>Países</th>
                </tr>
              </thead>
              <tbody>
                {sortedContinents.map((continent) => {
                  const selectedComparison = buildScopeComparisonItem(continent, selectedCode);
                  const isExpanded = expandedContinentId === continent.scopeId;
                  const isProjectedMode = regionalComparisonMode === "projected";
                  const comparisonVotes = isProjectedMode
                    ? selectedComparison.projectedVotes
                    : selectedComparison.actualVotes;
                  const comparisonPercentage = isProjectedMode
                    ? selectedComparison.projectedPercentage
                    : selectedComparison.actualPercentage;

                  return (
                    <Fragment key={continent.scopeId}>
                      <tr className={isExpanded ? "results-table__row is-expanded" : "results-table__row"}>
                        <td data-label="Continente">
                          <strong>{continent.label}</strong>
                        </td>
                        <td data-label="Actas">
                          {formatPercent(continent.actasContabilizadasPct, 2)}
                        </td>
                        <td data-label="Participación">
                          {formatPercent(continent.participacionCiudadanaPct, 2)}
                        </td>
                        <td
                          data-label={
                            showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"
                          }
                        >
                          <CandidateStack scope={continent} showOthers={showOthers} />
                        </td>
                        <td data-label={selectedComparisonLabel}>
                          <div className="comparison-cell">
                            <strong>{formatNumber(comparisonVotes)}</strong>
                            <span>{formatPercent(comparisonPercentage, 2)}</span>
                            <small>
                              {formatTitleCase(selectedComparison.label)} ·{" "}
                              {isProjectedMode ? "Proyectado" : "Actual ONPE"}
                            </small>
                          </div>
                        </td>
                        <td data-label="Países">
                          <button
                            className={`region-row-toggle ${isExpanded ? "is-active" : ""}`}
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={`continent-countries-${continent.scopeId}`}
                            aria-label={isExpanded ? `Ocultar países de ${continent.label}` : `Ver países de ${continent.label}`}
                            onClick={() => handleContinentToggle(continent.scopeId)}
                          >
                            <span className="region-row-toggle__icon" aria-hidden="true">
                              {isExpanded ? "−" : "+"}
                            </span>
                            <span className="region-row-toggle__label">
                              {isExpanded ? "Ocultar países" : "Ver países"}
                            </span>
                          </button>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr
                          className="region-detail-row"
                          id={`continent-countries-${continent.scopeId}`}
                        >
                          <td colSpan={6}>
                            <LeafScopeDrilldown
                              titleEyebrow="Detalle por país"
                              scopeLabel={continent.label}
                              itemSingularLabel="País"
                              itemPluralLabel="países"
                              recompositionLabel="La proyección continental se recompone desde sus países"
                              scopes={continent.countries ?? []}
                              selectedCode={selectedCode}
                              showOthers={showOthers}
                              comparisonMode={regionalComparisonMode}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
