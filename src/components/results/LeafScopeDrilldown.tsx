import { type ComparisonMode, type ComparisonPair, getScopeComparisonGap } from "../../lib/comparison";
import { getComparisonColumnLabel, getComparisonPairDetail } from "../../lib/comparisonDisplay";
import { formatPercent, formatSignedDecimal, formatSignedNumber } from "../../lib/format";
import { sortLeafScopes, type LeafScopeResult, type SortKey } from "../../lib/scopeSorting";
import { CandidateStack } from "./CandidateStack";
import { ComparisonCell } from "./ComparisonCell";

export function LeafScopeDrilldown({
  titleEyebrow,
  scopeLabel,
  itemSingularLabel,
  itemPluralLabel,
  recompositionLabel,
  scopes,
  showOthers,
  comparisonMode,
  comparisonPair,
  comparisonOptionLabels,
  sortKey
}: {
  titleEyebrow: string;
  scopeLabel: string;
  itemSingularLabel: string;
  itemPluralLabel: string;
  recompositionLabel: string;
  scopes: LeafScopeResult[];
  showOthers: boolean;
  comparisonMode: ComparisonMode;
  comparisonPair: ComparisonPair;
  comparisonOptionLabels: Map<string, string>;
  sortKey: SortKey;
}) {
  const comparisonLabel = getComparisonColumnLabel(comparisonMode);
  const sortedScopes = sortLeafScopes(scopes, sortKey, comparisonMode, comparisonPair);

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
          const comparisonGap = getScopeComparisonGap(scope, comparisonPair, comparisonMode);

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
                <ComparisonCell
                  votes={formatSignedNumber(comparisonGap.gapVotes)}
                  percentage={`${formatSignedDecimal(comparisonGap.gapPercentage, 2)} pp`}
                  detail={getComparisonPairDetail(comparisonPair, comparisonOptionLabels, comparisonMode)}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
