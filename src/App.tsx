import { useEffect, useMemo, useState } from "react";

import { fetchSnapshot, refreshSnapshot } from "./lib/api";
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
  formatNumber,
  formatPercent,
  formatRelativeMinutes,
  formatSignedDecimal,
  formatSignedNumber
} from "./lib/format";
import type { ElectionSnapshot, ScopeResult } from "./lib/types";

type SortKey = "electores" | "actas" | "participacion" | "candidate" | "projection";

function CandidatePill({
  code,
  label,
  active,
  featuredCodes,
  onClick
}: {
  code: string;
  label: string;
  active: boolean;
  featuredCodes: string[];
  onClick: (code: string) => void;
}) {
  return (
    <button
      className={`candidate-pill ${active ? "is-active" : ""}`}
      onClick={() => onClick(code)}
      style={{ ["--candidate-color" as string]: getCandidateColor(code, featuredCodes) }}
      type="button"
    >
      <span className="candidate-pill__dot" />
      {label}
    </button>
  );
}

function FeaturedBar({
  item,
  featuredCodes
}: {
  item: ComparisonItem;
  featuredCodes: string[];
}) {
  const color = getCandidateColor(item.code, featuredCodes);

  return (
    <article className="featured-bar">
      <div className="featured-bar__header">
        <div>
          <strong>{item.label}</strong>
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

function sortRegions(regions: ScopeResult[], selectedCode: string, sortKey: SortKey) {
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
    void loadSnapshot();
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
            Snapshot server-side desde ONPE, con extranjero separado y una proyección agregada
            de votos válidos según avance de actas por ámbito.
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
            <strong>{formatRelativeMinutes(snapshot.sourceLastUpdatedAt)}</strong>
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
                onClick={() => void loadSnapshot(true)}
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
            Suma de proyección regional Perú más el agregado de extranjero, extrapolada por avance
            de actas contabilizadas.
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
                featuredCodes={snapshot.featuredCandidateCodes}
              />
            ))}

            {showOthers && othersBar ? (
              <FeaturedBar
                item={othersBar}
                featuredCodes={snapshot.featuredCandidateCodes}
              />
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
                <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
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
                onClick={() => setShowOthers((value) => !value)}
              >
                {showOthers ? "Ocultar Otros" : "Mostrar Otros"}
              </button>

              <div className="control">
                <span>Columna final</span>
                <div className="toggle-group" role="tablist" aria-label="Comparación regional">
                  <button
                    className={`toggle-button ${
                      regionalComparisonMode === "projected" ? "is-active" : ""
                    }`}
                    type="button"
                    onClick={() => setRegionalComparisonMode("projected")}
                  >
                    Proyectado
                  </button>
                  <button
                    className={`toggle-button ${
                      regionalComparisonMode === "current" ? "is-active" : ""
                    }`}
                    type="button"
                    onClick={() => setRegionalComparisonMode("current")}
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
                featuredCodes={snapshot.featuredCandidateCodes}
                onClick={setSelectedCode}
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
                  <th>Candidatos destacados</th>
                  {showOthers ? <th>Otros</th> : null}
                  <th>
                    {regionalComparisonMode === "projected"
                      ? "Proyección seleccionada"
                      : "Actual seleccionado"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRegions.map((region) => {
                  const selectedComparison = buildScopeComparisonItem(region, selectedCode);
                  const isProjectedMode = regionalComparisonMode === "projected";
                  const comparisonVotes = isProjectedMode
                    ? selectedComparison.projectedVotes
                    : selectedComparison.actualVotes;
                  const comparisonPercentage = isProjectedMode
                    ? selectedComparison.projectedPercentage
                    : selectedComparison.actualPercentage;

                  return (
                    <tr key={region.scopeId}>
                      <td>
                        <strong>{region.label}</strong>
                      </td>
                      <td>{formatNumber(region.electores)}</td>
                      <td>{formatPercent(region.padronShare, 2)}</td>
                      <td>{formatPercent(region.actasContabilizadasPct, 2)}</td>
                      <td>{formatPercent(region.participacionCiudadanaPct, 2)}</td>
                      <td>
                        <div className="mini-stack">
                          {region.featuredCandidates.map((candidate) => (
                            <div key={candidate.code} className="mini-stack__row">
                              <span
                                className="mini-stack__swatch"
                                style={{
                                  background: getCandidateColor(
                                    candidate.code,
                                    snapshot.featuredCandidateCodes
                                  )
                                }}
                              />
                              <span>{candidate.candidateName}</span>
                              <strong>{formatPercent(candidate.pctValid, 2)}</strong>
                            </div>
                          ))}
                        </div>
                      </td>
                      {showOthers ? (
                        <td>
                          <div className="mini-stack__row">
                            <span
                              className="mini-stack__swatch"
                              style={{
                                background: getCandidateColor(
                                  "otros",
                                  snapshot.featuredCandidateCodes
                                )
                              }}
                            />
                            <span>Otros</span>
                            <strong>{formatPercent(region.otros.pctValid, 2)}</strong>
                          </div>
                        </td>
                      ) : null}
                      <td>
                        <div className="comparison-cell">
                          <strong>{formatNumber(comparisonVotes)}</strong>
                          <span>{formatPercent(comparisonPercentage, 2)}</span>
                          <small>
                            {selectedComparison.label} ·{" "}
                            {isProjectedMode ? "Proyectado" : "Actual ONPE"}
                          </small>
                        </div>
                      </td>
                    </tr>
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
