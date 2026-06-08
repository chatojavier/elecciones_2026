import { getCandidateColor } from "../../lib/constants";
import { formatDateTime, formatNumber, formatPercent, formatSignedDecimal, formatSignedNumber } from "../../lib/format";
import type { ComparisonItem } from "../../lib/comparison";

function CandidateCard({ item }: { item: ComparisonItem }) {
  return (
    <article className="second-round-summary__candidate">
      <p className="second-round-summary__candidate-label">
        <span
          className="second-round-summary__candidate-swatch"
          style={{ background: getCandidateColor(item.code) }}
        />
        {item.label}
      </p>
      <strong>{formatPercent(item.actualPercentage, 2)}</strong>
      <small>{formatNumber(item.actualVotes)} votos válidos</small>
    </article>
  );
}

export function SecondRoundSummarySection({
  candidateA,
  candidateB,
  sourceLastUpdatedAt,
  actasPeruPct,
  actasExteriorPct
}: {
  candidateA: ComparisonItem | null;
  candidateB: ComparisonItem | null;
  sourceLastUpdatedAt: string;
  actasPeruPct: number;
  actasExteriorPct: number;
}) {
  const gapVotes =
    candidateA && candidateB ? candidateA.actualVotes - candidateB.actualVotes : null;
  const gapPp =
    candidateA && candidateB
      ? candidateA.actualPercentage - candidateB.actualPercentage
      : null;

  return (
    <section className="panel second-round-summary" id="segunda-vuelta-resumen">
      <div className="panel__header panel__header--stack">
        <div>
          <p className="eyebrow">Segunda vuelta</p>
          <h2>Resultado actual entre finalistas</h2>
          <p>
            Corte ONPE vigente para el balotaje, con progreso de actas en Perú y exterior.
          </p>
        </div>
      </div>

      <div className="second-round-summary__grid">
        {candidateA ? <CandidateCard item={candidateA} /> : null}
        {candidateB ? <CandidateCard item={candidateB} /> : null}
        <article className="second-round-summary__metric">
          <span>Brecha actual</span>
          <strong>{gapPp === null ? "Sin dato" : `${formatSignedDecimal(gapPp, 2)} pp`}</strong>
          <small>{gapVotes === null ? "Sin dato" : `${formatSignedNumber(gapVotes)} votos`}</small>
        </article>
        <article className="second-round-summary__metric">
          <span>Actas Perú</span>
          <strong>{formatPercent(actasPeruPct, 2)}</strong>
          <small>Avance nacional</small>
        </article>
        <article className="second-round-summary__metric">
          <span>Actas exterior</span>
          <strong>{formatPercent(actasExteriorPct, 2)}</strong>
          <small>Avance fuera del país</small>
        </article>
        <article className="second-round-summary__metric">
          <span>Última publicación ONPE</span>
          <strong>{formatDateTime(sourceLastUpdatedAt)}</strong>
          <small>Hora visible en el snapshot</small>
        </article>
      </div>
    </section>
  );
}
