import { Fragment } from "react";

import { type ComparisonMode, type ComparisonPair } from "../../lib/comparison";
import { formatPercent } from "../../lib/format";
import { type SortKey } from "../../lib/scopeSorting";
import type { ForeignContinentResult } from "../../lib/types";
import { CandidateStack, ComparisonCell, LeafScopeDrilldown } from "../results";

export function ForeignResultsTable({
  continents,
  foreignSearchQuery,
  showOthers,
  selectedComparisonLabel,
  comparisonMode,
  comparisonPair,
  comparisonOptionLabels,
  expandedContinentId,
  onSearchChange,
  onContinentToggle,
  getScopeComparisonDisplay,
  sortKey
}: {
  continents: ForeignContinentResult[];
  foreignSearchQuery: string;
  showOthers: boolean;
  selectedComparisonLabel: string;
  comparisonMode: ComparisonMode;
  comparisonPair: ComparisonPair | null;
  comparisonOptionLabels: Map<string, string>;
  expandedContinentId: string | null;
  onSearchChange: (nextQuery: string) => void;
  onContinentToggle: (continentId: string) => void;
  getScopeComparisonDisplay: (scope: ForeignContinentResult) => { votes: string; percentage: string; detail: string };
  sortKey: SortKey;
}) {
  return (
    <section className="panel" id="lectura-exterior">
      <div className="panel__header panel__header--stack">
        <div>
          <p className="eyebrow">Lectura exterior</p>
          <h2>Tabla de continentes y países</h2>
        </div>

        <div className="controls">
          <label className="control">
            <span>Buscar continente o país</span>
            <input
              type="search"
              value={foreignSearchQuery}
              onInput={(event) => onSearchChange((event.target as HTMLInputElement).value)}
              placeholder="Ej. Europa o España"
            />
          </label>
        </div>
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
            {continents.map((continent) => {
              const isExpanded = expandedContinentId === continent.scopeId;
              const comparisonDisplay = getScopeComparisonDisplay(continent);

              return (
                <Fragment key={continent.scopeId}>
                  <tr className={isExpanded ? "results-table__row is-expanded" : "results-table__row"}>
                    <td data-label="Continente">
                      <strong>{continent.label}</strong>
                    </td>
                    <td data-label="Actas">{formatPercent(continent.actasContabilizadasPct, 2)}</td>
                    <td data-label="Participación">{formatPercent(continent.participacionCiudadanaPct, 2)}</td>
                    <td data-label={showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"}>
                      <CandidateStack scope={continent} showOthers={showOthers} />
                    </td>
                    <td data-label={selectedComparisonLabel}>
                      <ComparisonCell
                        votes={comparisonDisplay.votes}
                        percentage={comparisonDisplay.percentage}
                        detail={comparisonDisplay.detail}
                      />
                    </td>
                    <td data-label="Países">
                      <button
                        className={`region-row-toggle ${isExpanded ? "is-active" : ""}`}
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`continent-countries-${continent.scopeId}`}
                        aria-label={isExpanded ? `Ocultar países de ${continent.label}` : `Ver países de ${continent.label}`}
                        onClick={() => onContinentToggle(continent.scopeId)}
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

                  {isExpanded && comparisonPair ? (
                    <tr className="region-detail-row" id={`continent-countries-${continent.scopeId}`}>
                      <td colSpan={6}>
                        <LeafScopeDrilldown
                          titleEyebrow="Detalle por país"
                          scopeLabel={continent.label}
                          itemSingularLabel="País"
                          itemPluralLabel="países"
                          recompositionLabel="La proyección continental se recompone desde sus países"
                          scopes={continent.countries ?? []}
                          showOthers={showOthers}
                          comparisonMode={comparisonMode}
                          comparisonPair={comparisonPair}
                          comparisonOptionLabels={comparisonOptionLabels}
                          sortKey={sortKey}
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
  );
}
