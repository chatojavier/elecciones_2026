import { Fragment } from "react";

import { type ComparisonMode, type ComparisonPair } from "../../lib/comparison";
import { formatNumber, formatPercent } from "../../lib/format";
import { type SortKey } from "../../lib/scopeSorting";
import type { RegionResult } from "../../lib/types";
import { CandidateStack, ComparisonCell, LeafScopeDrilldown } from "../results";

export function RegionalResultsTable({
  regions,
  sortKey,
  regionSearchQuery,
  showOthers,
  selectedComparisonLabel,
  comparisonMode,
  comparisonPair,
  comparisonOptionLabels,
  expandedRegionId,
  onSortChange,
  onSearchChange,
  onRegionToggle,
  getScopeComparisonDisplay
}: {
  regions: RegionResult[];
  sortKey: SortKey;
  regionSearchQuery: string;
  showOthers: boolean;
  selectedComparisonLabel: string;
  comparisonMode: ComparisonMode;
  comparisonPair: ComparisonPair | null;
  comparisonOptionLabels: Map<string, string>;
  expandedRegionId: string | null;
  onSortChange: (nextSortKey: SortKey) => void;
  onSearchChange: (nextQuery: string) => void;
  onRegionToggle: (regionId: string) => void;
  getScopeComparisonDisplay: (scope: RegionResult) => { votes: string; percentage: string; detail: string };
}) {
  return (
    <section className="panel" id="lectura-regional">
      <div className="panel__header panel__header--stack">
        <div>
          <p className="eyebrow">Lectura regional</p>
          <h2>Tabla de 25 regiones</h2>
        </div>

        <div className="controls">
          <label className="control">
            <span>Ordenar por</span>
            <select value={sortKey} onChange={(event) => onSortChange(event.target.value as SortKey)}>
              <option value="gap_2v3">Brecha A vs B</option>
              <option value="electores">Electores</option>
              <option value="actas">Actas</option>
              <option value="participacion">Participación</option>
              <option value="projection">Proyección A</option>
              <option value="candidate">Candidato A</option>
            </select>
          </label>
          <label className="control">
            <span>Buscar región</span>
            <input
              type="search"
              value={regionSearchQuery}
              onInput={(event) => onSearchChange((event.target as HTMLInputElement).value)}
              placeholder="Ej. Arequipa"
            />
          </label>
        </div>
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
            {regions.map((region) => {
              const isExpanded = expandedRegionId === region.scopeId;
              const comparisonDisplay = getScopeComparisonDisplay(region);

              return (
                <Fragment key={region.scopeId}>
                  <tr className={isExpanded ? "results-table__row is-expanded" : "results-table__row"}>
                    <td data-label="Región">
                      <strong>{region.label}</strong>
                    </td>
                    <td data-label="Electores">{formatNumber(region.electores)}</td>
                    <td data-label="% padrón">{formatPercent(region.padronShare, 2)}</td>
                    <td data-label="Actas">{formatPercent(region.actasContabilizadasPct, 2)}</td>
                    <td data-label="Participación">{formatPercent(region.participacionCiudadanaPct, 2)}</td>
                    <td data-label={showOthers ? "Candidatos destacados + Otros" : "Candidatos destacados"}>
                      <CandidateStack scope={region} showOthers={showOthers} />
                    </td>
                    <td data-label={selectedComparisonLabel}>
                      <ComparisonCell
                        votes={comparisonDisplay.votes}
                        percentage={comparisonDisplay.percentage}
                        detail={comparisonDisplay.detail}
                      />
                    </td>
                    <td data-label="Provincias">
                      <button
                        className={`region-row-toggle ${isExpanded ? "is-active" : ""}`}
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`region-provinces-${region.scopeId}`}
                        aria-label={isExpanded ? `Ocultar provincias de ${region.label}` : `Ver provincias de ${region.label}`}
                        onClick={() => onRegionToggle(region.scopeId)}
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

                  {isExpanded && comparisonPair ? (
                    <tr className="region-detail-row" id={`region-provinces-${region.scopeId}`}>
                      <td colSpan={8}>
                        <LeafScopeDrilldown
                          titleEyebrow="Detalle provincial"
                          scopeLabel={region.label}
                          itemSingularLabel="Provincia"
                          itemPluralLabel="provincias"
                          recompositionLabel="La proyección regional se recompone desde sus provincias"
                          scopes={region.provinces}
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
