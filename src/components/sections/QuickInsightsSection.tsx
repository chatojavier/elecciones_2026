import { getCandidateColor } from "../../lib/constants";
import { type ComparisonItem } from "../../lib/comparison";

type QuickInsightGapStatus = "stable" | "tight" | "very_tight" | "unknown";

function getQuickInsightGapStatus(gapPp: number | null): QuickInsightGapStatus {
  if (gapPp === null) {
    return "unknown";
  }

  const absoluteGap = Math.abs(gapPp);

  if (absoluteGap < 0.5) {
    return "very_tight";
  }

  if (absoluteGap < 1.5) {
    return "tight";
  }

  return "stable";
}

function getQuickInsightGapStatusCopy(status: QuickInsightGapStatus) {
  switch (status) {
    case "stable":
      return { label: "Estable", className: "quick-insights__status-badge is-stable" };
    case "tight":
      return { label: "Ajustado", className: "quick-insights__status-badge is-tight" };
    case "very_tight":
      return { label: "Muy ajustado", className: "quick-insights__status-badge is-very-tight" };
    default:
      return { label: "Sin dato", className: "quick-insights__status-badge" };
  }
}

function getQuickInsightDeltaBadgeClass(item: ComparisonItem | null) {
  if (!item) {
    return "quick-insight-kpi__delta-badge";
  }

  return `quick-insight-kpi__delta-badge ${item.deltaPercentage >= 0 ? "is-positive" : "is-negative"}`;
}

export function QuickInsightsSkeleton() {
  return (
    <section className="quick-insights quick-insights--loading" aria-label="Cargando resumen rápido">
      <div className="quick-insights__header">
        <div className="quick-insights__header-main">
          <p className="eyebrow">Resumen rápido</p>
          <h2>Comparativa rápida de candidatos</h2>
        </div>
        <div className="quick-insights__chips quick-insights__chips--header">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="quick-insight-chip is-skeleton" />
          ))}
        </div>
      </div>
      <div className="quick-insights__matrix">
        <div className="quick-insights__matrix-head">
          <span className="quick-insight-kpi__skeleton quick-insight-kpi__skeleton--label" />
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="quick-insight-kpi__skeleton quick-insight-kpi__skeleton--label" />
          ))}
        </div>
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={groupIndex} className="quick-insights__matrix-row">
            <p className="quick-insights__row-label is-skeleton">Resumen</p>
            {Array.from({ length: 3 }).map((__, index) => (
              <article key={`${groupIndex}-${index}`} className="quick-insight-kpi is-skeleton">
                <span className="quick-insight-kpi__skeleton quick-insight-kpi__skeleton--label" />
                <span className="quick-insight-kpi__skeleton quick-insight-kpi__skeleton--value" />
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function QuickInsightsSection({
  quickInsightsTitle,
  actasPeruValue,
  actasExteriorValue,
  deltaProyeccionValue,
  candidateA,
  candidateB,
  current,
  projected,
  onDetailClick
}: {
  quickInsightsTitle: string;
  actasPeruValue: string;
  actasExteriorValue: string;
  deltaProyeccionValue: string;
  candidateA: { label: string; code: string; deltaValue: string | null; item: ComparisonItem | null };
  candidateB: { label: string; code: string; deltaValue: string | null; item: ComparisonItem | null };
  current: {
    candidateAPercentageValue: string | null;
    candidateAVotesValue: string | null;
    candidateBPercentageValue: string | null;
    candidateBVotesValue: string | null;
    gapPpValue: string | null;
    gapVotesValue: string | null;
    gapRaw: number | null;
  };
  projected: {
    candidateAPercentageValue: string | null;
    candidateAVotesValue: string | null;
    candidateBPercentageValue: string | null;
    candidateBVotesValue: string | null;
    gapPpValue: string | null;
    gapVotesValue: string | null;
    gapRaw: number | null;
  };
  onDetailClick: () => void;
}) {
  const currentGapStatusCopy = getQuickInsightGapStatusCopy(getQuickInsightGapStatus(current.gapRaw));
  const projectedGapStatusCopy = getQuickInsightGapStatusCopy(getQuickInsightGapStatus(projected.gapRaw));

  return (
    <section className="quick-insights" aria-labelledby="quick-insights-title">
      <div className="quick-insights__header">
        <div className="quick-insights__header-main">
          <p className="eyebrow">Resumen rápido</p>
          <h2 id="quick-insights-title">Comparativa rápida de candidatos</h2>
          <p>
            Contraste inmediato de {quickInsightsTitle} en el total de la elección, con corte actual y proyección.
          </p>
        </div>
        <div
          className="quick-insights__chips quick-insights__chips--header"
          aria-label="Contexto de la comparativa rápida"
        >
          <span className="quick-insight-chip">Actas Perú: {actasPeruValue}</span>
          <span className="quick-insight-chip">Actas exterior: {actasExteriorValue}</span>
          <span className="quick-insight-chip">Delta proyección: {deltaProyeccionValue} votos</span>
        </div>
      </div>
      <div className="quick-insights__actions">
        <a className="quick-insights__cta" href="#comparativa-central" onClick={onDetailClick}>
          Ver comparativa personalizada
        </a>
      </div>

      <div className="quick-insights__matrix" aria-label="Comparativa rápida actual y proyectada de los candidatos seleccionados">
        <div className="quick-insights__matrix-head" aria-hidden="true">
          <span />
          <p className="quick-insights__candidate-heading">
            <span className="quick-insights__candidate-swatch" style={{ background: getCandidateColor(candidateA.code) }} />
            {candidateA.label}
          </p>
          <p className="quick-insights__candidate-heading">
            <span className="quick-insights__candidate-swatch" style={{ background: getCandidateColor(candidateB.code) }} />
            {candidateB.label}
          </p>
          <p>Brecha A vs B</p>
        </div>

        <div className="quick-insights__matrix-row">
          <p className="quick-insights__row-label">Actual ONPE</p>
          <article className="quick-insight-kpi">
            <p className="quick-insight-kpi__mobile-label quick-insight-kpi__mobile-label--candidate">
              <span className="quick-insights__candidate-swatch" style={{ background: getCandidateColor(candidateA.code) }} />
              {candidateA.label}
            </p>
            <strong>{current.candidateAPercentageValue ?? "Insight no disponible"}</strong>
            <small>{current.candidateAVotesValue ?? "Sin dato"}</small>
          </article>
          <article className="quick-insight-kpi">
            <p className="quick-insight-kpi__mobile-label quick-insight-kpi__mobile-label--candidate">
              <span className="quick-insights__candidate-swatch" style={{ background: getCandidateColor(candidateB.code) }} />
              {candidateB.label}
            </p>
            <strong>{current.candidateBPercentageValue ?? "Insight no disponible"}</strong>
            <small>{current.candidateBVotesValue ?? "Sin dato"}</small>
          </article>
          <article className="quick-insight-kpi quick-insight-kpi--has-floating-badge">
            <div className="quick-insight-kpi__heading quick-insight-kpi__heading--floating">
              <p className="quick-insight-kpi__mobile-label">Brecha A vs B</p>
              <span className={currentGapStatusCopy.className}>{currentGapStatusCopy.label}</span>
            </div>
            <strong>{current.gapPpValue ?? "Insight no disponible"}</strong>
            <small>{current.gapVotesValue ?? "Sin dato"}</small>
          </article>
        </div>

        <div className="quick-insights__matrix-row">
          <p className="quick-insights__row-label">Proyección total</p>
          <article className="quick-insight-kpi quick-insight-kpi--has-floating-badge">
            <div className="quick-insight-kpi__heading quick-insight-kpi__heading--floating">
              <p className="quick-insight-kpi__mobile-label quick-insight-kpi__mobile-label--candidate">
                <span className="quick-insights__candidate-swatch" style={{ background: getCandidateColor(candidateA.code) }} />
                {candidateA.label}
              </p>
              <span className={getQuickInsightDeltaBadgeClass(candidateA.item)}>
                {candidateA.deltaValue ?? "Sin dato"}
              </span>
            </div>
            <strong>{projected.candidateAPercentageValue ?? "Insight no disponible"}</strong>
            <small>{projected.candidateAVotesValue ?? "Sin dato"}</small>
          </article>
          <article className="quick-insight-kpi quick-insight-kpi--has-floating-badge">
            <div className="quick-insight-kpi__heading quick-insight-kpi__heading--floating">
              <p className="quick-insight-kpi__mobile-label quick-insight-kpi__mobile-label--candidate">
                <span className="quick-insights__candidate-swatch" style={{ background: getCandidateColor(candidateB.code) }} />
                {candidateB.label}
              </p>
              <span className={getQuickInsightDeltaBadgeClass(candidateB.item)}>
                {candidateB.deltaValue ?? "Sin dato"}
              </span>
            </div>
            <strong>{projected.candidateBPercentageValue ?? "Insight no disponible"}</strong>
            <small>{projected.candidateBVotesValue ?? "Sin dato"}</small>
          </article>
          <article className="quick-insight-kpi quick-insight-kpi--has-floating-badge">
            <div className="quick-insight-kpi__heading quick-insight-kpi__heading--floating">
              <p className="quick-insight-kpi__mobile-label">Brecha A vs B</p>
              <span className={projectedGapStatusCopy.className}>{projectedGapStatusCopy.label}</span>
            </div>
            <strong>{projected.gapPpValue ?? "Insight no disponible"}</strong>
            <small>{projected.gapVotesValue ?? "Sin dato"}</small>
          </article>
        </div>
      </div>
    </section>
  );
}
