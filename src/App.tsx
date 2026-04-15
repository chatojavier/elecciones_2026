import { useEffect, useMemo, useState } from "react";

import { fetchSnapshot } from "./lib/api";
import { CANDIDATE_COLOR_MAP, FEATURED_CANDIDATE_CODES } from "./lib/constants";
import {
  formatCompactNumber,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeMinutes
} from "./lib/format";
import type { ElectionSnapshot, ScopeResult } from "./lib/types";

type SortKey = "electores" | "actas" | "participacion" | "candidate" | "projection";

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
      style={{ ["--candidate-color" as string]: CANDIDATE_COLOR_MAP[code] }}
      type="button"
    >
      <span className="candidate-pill__dot" />
      {label}
    </button>
  );
}

function FeaturedBar({
  label,
  percentage,
  votes,
  code
}: {
  label: string;
  percentage: number;
  votes: number;
  code: string;
}) {
  return (
    <article className="featured-bar">
      <div className="featured-bar__header">
        <strong>{label}</strong>
        <span>{formatPercent(percentage, 2)}</span>
      </div>
      <div className="featured-bar__track">
        <div
          className="featured-bar__fill"
          style={{
            width: `${Math.max(percentage, 0.5)}%`,
            background: CANDIDATE_COLOR_MAP[code]
          }}
        />
      </div>
      <small>{formatNumber(votes)} votos proyectados</small>
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
  const [sortKey, setSortKey] = useState<SortKey>("projection");
  const [selectedCode, setSelectedCode] = useState<string>(FEATURED_CANDIDATE_CODES[0]);
  const [showOthers, setShowOthers] = useState(true);

  useEffect(() => {
    fetchSnapshot()
      .then((data) => {
        setSnapshot(data);
        setError(null);
      })
      .catch((reason) => {
        setError((reason as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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

  const featuredProjectionBars = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.national.featuredCandidates.map((candidate) => ({
      code: candidate.code,
      label: candidate.candidateName,
      percentage: snapshot.projectedNational.projectedPercentages[candidate.code] ?? 0,
      votes: snapshot.projectedNational.projectedVotes[candidate.code] ?? 0
    }));
  }, [snapshot]);

  const othersBar = snapshot
    ? {
        code: "otros",
        label: "Otros",
        percentage: snapshot.projectedNational.projectedPercentages.otros ?? 0,
        votes: snapshot.projectedNational.projectedVotes.otros ?? 0
      }
    : null;

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
            sobre electores congelados por ámbito.
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
            <span>Estado</span>
            <strong className={snapshot.isStale ? "status-badge is-stale" : "status-badge"}>
              {snapshot.isStale ? "Stale" : "Al día"}
            </strong>
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
          <h2>{formatNumber(snapshot.projectedNational.totalElectores)} electores considerados</h2>
          <p>
            Suma de proyección regional Perú más el agregado de extranjero sobre padrón
            congelado.
          </p>
        </section>
      </section>

      <section className="content-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Comparativa central</p>
              <h2>Candidatos destacados + Otros</h2>
            </div>
          </div>

          <div className="featured-bars">
            {featuredProjectionBars.map((item) => (
              <FeaturedBar
                key={item.code}
                code={item.code}
                label={item.label}
                percentage={item.percentage}
                votes={item.votes}
              />
            ))}

            {showOthers && othersBar ? (
              <FeaturedBar
                code={othersBar.code}
                label={othersBar.label}
                percentage={othersBar.percentage}
                votes={othersBar.votes}
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
            </div>
          </div>

          <div className="candidate-pill-row">
            {featuredLegend.map((candidate) => (
              <CandidatePill
                key={candidate.code}
                code={candidate.code}
                label={candidate.label}
                active={candidate.code === selectedCode}
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
                  <th>Proyección seleccionada</th>
                </tr>
              </thead>
              <tbody>
                {sortedRegions.map((region) => {
                  const selectedCandidate = region.featuredCandidates.find(
                    (candidate) => candidate.code === selectedCode
                  );

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
                                style={{ background: CANDIDATE_COLOR_MAP[candidate.code] }}
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
                              style={{ background: CANDIDATE_COLOR_MAP.otros }}
                            />
                            <span>Otros</span>
                            <strong>{formatPercent(region.otros.pctValid, 2)}</strong>
                          </div>
                        </td>
                      ) : null}
                      <td>
                        <strong>{formatNumber(region.projectedVotes[selectedCode] ?? 0)}</strong>
                        <small>{selectedCandidate?.candidateName ?? "Sin dato"}</small>
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
