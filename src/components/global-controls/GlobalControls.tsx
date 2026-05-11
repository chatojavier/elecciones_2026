import { forwardRef } from "react";

import type { ComparisonCandidateOption, ComparisonMode, ComparisonPair } from "../../lib/comparison";
import { formatTitleCase } from "../../lib/format";
import type { ComparisonSelector } from "./useComparisonControls";

interface MobileSummary {
  candidateA: string;
  candidateB: string;
  comparisonMode: string;
  others: string;
}

export interface GlobalControlsProps {
  isMobileControlsSticky: boolean;
  showMobileControlsSummary: boolean;
  showInlineGlobalControlsRow: boolean;
  showMobileControlsOverlay: boolean;
  isMobileControlsOverlayOpen: boolean;
  mobileSummary: MobileSummary;
  onMobileControlsToggle: () => void;
  comparisonCandidateOptions: ComparisonCandidateOption[];
  comparisonPair: ComparisonPair | null;
  comparisonInvalidSelector: ComparisonSelector | null;
  comparisonNotice: string | null;
  comparisonNoticeClassName: string;
  onComparisonCandidateChange: (selector: ComparisonSelector, nextCode: string) => void;
  comparisonMode: ComparisonMode;
  onComparisonModeChange: (nextMode: ComparisonMode) => void;
  showOthers: boolean;
  onShowOthersToggle: () => void;
  onGlobalReset: () => void;
}

export const GlobalControls = forwardRef<HTMLElement, GlobalControlsProps>(function GlobalControls(
  props,
  ref
) {
  const {
    isMobileControlsSticky,
    showMobileControlsSummary,
    showInlineGlobalControlsRow,
    showMobileControlsOverlay,
    isMobileControlsOverlayOpen,
    mobileSummary,
    onMobileControlsToggle,
    comparisonCandidateOptions,
    comparisonPair,
    comparisonInvalidSelector,
    comparisonNotice,
    comparisonNoticeClassName,
    onComparisonCandidateChange,
    comparisonMode,
    onComparisonModeChange,
    showOthers,
    onShowOthersToggle,
    onGlobalReset
  } = props;

  const globalControlsRow = (
    <div className="global-controls__row">
      <div className="control control--candidate-pair">
        <div className="global-controls__pair">
          <label className="control control--candidate">
            <span>Candidato A</span>
            <select
              className="global-controls__select"
              aria-label="Candidato A"
              aria-invalid={comparisonInvalidSelector === "candidate_a"}
              value={comparisonPair?.candidateACode ?? ""}
              onChange={(event) => onComparisonCandidateChange("candidate_a", event.target.value)}
            >
              {comparisonCandidateOptions.map((candidate) => (
                <option key={`candidate-a-${candidate.code}`} value={candidate.code}>
                  {formatTitleCase(candidate.label)}
                </option>
              ))}
            </select>
          </label>

          <label className="control control--candidate">
            <span>Candidato B</span>
            <select
              className="global-controls__select"
              aria-label="Candidato B"
              aria-invalid={comparisonInvalidSelector === "candidate_b"}
              value={comparisonPair?.candidateBCode ?? ""}
              onChange={(event) => onComparisonCandidateChange("candidate_b", event.target.value)}
            >
              {comparisonCandidateOptions.map((candidate) => (
                <option key={`candidate-b-${candidate.code}`} value={candidate.code}>
                  {formatTitleCase(candidate.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {comparisonNotice ? (
          <small className={comparisonNoticeClassName} aria-live="polite">
            {comparisonNotice}
          </small>
        ) : null}
      </div>

      <div className="control">
        <span>Comparar</span>
        <select
          className="global-controls__select"
          aria-label="Comparar"
          value={comparisonMode}
          onChange={(event) => onComparisonModeChange(event.target.value as ComparisonMode)}
        >
          <option value="projected">Proyectado</option>
          <option value="current">Actual ONPE</option>
        </select>
      </div>

      <div className="control control--compact">
        <span>Otros</span>
        <button
          className={`toggle-button ${showOthers ? "is-active" : ""}`}
          type="button"
          aria-pressed={showOthers}
          onClick={onShowOthersToggle}
        >
          {showOthers ? "On" : "Off"}
        </button>
      </div>

      <div className="control control--compact">
        <span>Reset</span>
        <button className="toggle-button" type="button" onClick={onGlobalReset}>
          Reset
        </button>
      </div>

      <div className="global-controls__meta">
        <nav className="global-controls__quick-nav" aria-label="Navegación rápida">
          <a href="#lectura-regional">Regiones</a>
          <a href="#lectura-exterior">Exterior</a>
        </nav>
      </div>
    </div>
  );

  return (
    <section
      ref={ref}
      className={`global-controls ${isMobileControlsSticky ? "is-mobile-sticky" : ""} ${showMobileControlsOverlay ? "is-overlay-open" : ""}`}
      aria-label="Controles globales"
    >
      {showMobileControlsSummary ? (
        <div className="global-controls__mobile-summary">
          <div className="global-controls__mobile-summary-text">
            <span>{mobileSummary.candidateA}</span>
            <span>{mobileSummary.candidateB}</span>
            <span>{mobileSummary.comparisonMode}</span>
            <span>{mobileSummary.others}</span>
          </div>
          <button
            className="global-controls__mobile-toggle"
            type="button"
            aria-expanded={isMobileControlsOverlayOpen}
            aria-label={isMobileControlsOverlayOpen ? "Ocultar filtros" : "Abrir filtros"}
            onClick={onMobileControlsToggle}
          >
            <span
              className={`global-controls__mobile-toggle-icon ${isMobileControlsOverlayOpen ? "" : "is-collapsed"}`}
              aria-hidden="true"
            />
          </button>
        </div>
      ) : null}

      {showInlineGlobalControlsRow ? globalControlsRow : null}

      {showMobileControlsOverlay ? (
        <div className="global-controls__mobile-overlay" role="dialog" aria-label="Filtros globales">
          {globalControlsRow}
        </div>
      ) : null}
    </section>
  );
});
