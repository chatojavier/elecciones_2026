import { useEffect, useMemo, useRef, useState } from "react";

import { trackEvent } from "../../lib/analytics";
import {
  buildComparisonCandidateOptions,
  reconcileComparisonPair,
  resolveDefaultComparisonPair,
  type ComparisonMode,
  type ComparisonPair
} from "../../lib/comparison";
import { formatTitleCase } from "../../lib/format";
import type { ElectionSnapshot } from "../../lib/types";

export const DEFAULT_COMPARISON_MODE: ComparisonMode = "projected";
export const DEFAULT_SHOW_OTHERS = false;

export type ComparisonSelector = "candidate_a" | "candidate_b";
export type GlobalControlChangeSource = "global_bar" | "quick_insight_cta";

interface UseComparisonControlsOptions {
  onResetSort?: () => void;
}

function trackGlobalControlChange(
  snapshotGeneratedAt: string | undefined,
  controlName: "comparison_mode" | "show_others" | "reset",
  previousValue: string | boolean,
  nextValue: string | boolean,
  source: GlobalControlChangeSource = "global_bar"
) {
  if (previousValue === nextValue) {
    return;
  }

  trackEvent("global_control_change", {
    control_name: controlName,
    previous_value: previousValue,
    next_value: nextValue,
    source,
    snapshot_generated_at: snapshotGeneratedAt
  });
}

export function useComparisonControls(
  snapshot: ElectionSnapshot | null,
  options: UseComparisonControlsOptions = {}
) {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(DEFAULT_COMPARISON_MODE);
  const [comparisonPair, setComparisonPair] = useState<ComparisonPair | null>(null);
  const [comparisonValidationMessage, setComparisonValidationMessage] = useState<string | null>(null);
  const [comparisonInvalidSelector, setComparisonInvalidSelector] = useState<ComparisonSelector | null>(null);
  const [comparisonAdjustmentMessage, setComparisonAdjustmentMessage] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(DEFAULT_SHOW_OTHERS);
  const comparisonPairInitializationRef = useRef<string | null>(null);
  const globalControlsImpressionRef = useRef<string | null>(null);

  const comparisonCandidateOptions = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return buildComparisonCandidateOptions(snapshot);
  }, [snapshot]);

  const comparisonOptionLabels = useMemo(
    () => new Map(comparisonCandidateOptions.map((candidate) => [candidate.code, candidate.label])),
    [comparisonCandidateOptions]
  );

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const resolution = comparisonPair
      ? reconcileComparisonPair(snapshot, comparisonPair)
      : resolveDefaultComparisonPair(snapshot);
    const nextPair = resolution.pair;
    const pairChanged =
      comparisonPair?.candidateACode !== nextPair.candidateACode ||
      comparisonPair?.candidateBCode !== nextPair.candidateBCode;
    const initializationKey = `${snapshot.generatedAt}:${nextPair.candidateACode}:${nextPair.candidateBCode}`;

    if (!comparisonPair || pairChanged) {
      setComparisonPair(nextPair);
    }

    setComparisonValidationMessage(null);
    setComparisonInvalidSelector(null);

    if (!comparisonPair || (resolution.status === "reassigned" && pairChanged)) {
      if (comparisonPairInitializationRef.current !== initializationKey) {
        trackEvent("comparison_pair_initialized", {
          candidate_a_code: nextPair.candidateACode || undefined,
          candidate_b_code: nextPair.candidateBCode || undefined,
          init_source: resolution.initSource,
          snapshot_generated_at: snapshot.generatedAt
        });
        comparisonPairInitializationRef.current = initializationKey;
      }
    }

    if (!comparisonPair) {
      setComparisonAdjustmentMessage(
        resolution.initSource === "fallback"
          ? "Ajustamos la comparación al mejor par disponible."
          : null
      );
      return;
    }

    if (resolution.status === "reassigned" && pairChanged) {
      setComparisonAdjustmentMessage("Actualizamos la comparación con el mejor candidato disponible.");
      return;
    }

    setComparisonAdjustmentMessage(null);
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || !comparisonPair) {
      return;
    }

    if (globalControlsImpressionRef.current === snapshot.generatedAt) {
      return;
    }

    trackEvent("global_controls_impression", {
      candidate_a_code: comparisonPair.candidateACode,
      candidate_b_code: comparisonPair.candidateBCode,
      comparison_mode: comparisonMode,
      show_others: showOthers,
      snapshot_generated_at: snapshot.generatedAt
    });
    globalControlsImpressionRef.current = snapshot.generatedAt;
  }, [comparisonMode, comparisonPair, showOthers, snapshot]);

  function handleComparisonCandidateChange(selector: ComparisonSelector, nextCode: string) {
    if (!comparisonPair) {
      return;
    }

    const nextPair =
      selector === "candidate_a"
        ? {
          candidateACode: nextCode,
          candidateBCode: comparisonPair.candidateBCode
        }
        : {
          candidateACode: comparisonPair.candidateACode,
          candidateBCode: nextCode
        };

    if (nextPair.candidateACode === nextPair.candidateBCode) {
      setComparisonInvalidSelector(selector);
      setComparisonValidationMessage("Selecciona dos candidatos distintos.");
      trackEvent("comparison_validation_error", {
        candidate_a_code: nextPair.candidateACode,
        candidate_b_code: nextPair.candidateBCode,
        snapshot_generated_at: snapshot?.generatedAt
      });
      return;
    }

    setComparisonPair(nextPair);
    setComparisonInvalidSelector(null);
    setComparisonValidationMessage(null);
    setComparisonAdjustmentMessage(null);
    trackEvent("comparison_candidate_change", {
      candidate_a_code: nextPair.candidateACode,
      candidate_b_code: nextPair.candidateBCode,
      snapshot_generated_at: snapshot?.generatedAt
    });
  }

  function handleComparisonModeChange(
    nextMode: ComparisonMode,
    source: GlobalControlChangeSource = "global_bar"
  ) {
    setComparisonMode((currentMode) => {
      trackGlobalControlChange(
        snapshot?.generatedAt,
        "comparison_mode",
        currentMode,
        nextMode,
        source
      );
      return nextMode;
    });
  }

  function handleShowOthersToggle() {
    setShowOthers((currentValue) => {
      const nextValue = !currentValue;
      trackGlobalControlChange(snapshot?.generatedAt, "show_others", currentValue, nextValue);
      return nextValue;
    });
  }

  function handleGlobalReset() {
    if (!snapshot) {
      return;
    }

    const defaultPairResolution = resolveDefaultComparisonPair(snapshot);
    trackGlobalControlChange(snapshot.generatedAt, "reset", "custom_state", "editorial_defaults");
    trackGlobalControlChange(
      snapshot.generatedAt,
      "comparison_mode",
      comparisonMode,
      DEFAULT_COMPARISON_MODE
    );
    trackGlobalControlChange(snapshot.generatedAt, "show_others", showOthers, DEFAULT_SHOW_OTHERS);
    setComparisonPair(defaultPairResolution.pair);
    setComparisonMode(DEFAULT_COMPARISON_MODE);
    setShowOthers(DEFAULT_SHOW_OTHERS);
    options.onResetSort?.();
    setComparisonInvalidSelector(null);
    setComparisonValidationMessage(null);
    setComparisonAdjustmentMessage(
      defaultPairResolution.initSource === "fallback"
        ? "Ajustamos la comparación al mejor par disponible."
        : null
    );
  }

  const comparisonNotice = comparisonValidationMessage ?? comparisonAdjustmentMessage;
  const comparisonNoticeClassName = comparisonValidationMessage
    ? "global-controls__notice global-controls__notice--error"
    : "global-controls__notice";
  const mobileSummary = {
    candidateA: comparisonPair
      ? `A: ${formatTitleCase(comparisonOptionLabels.get(comparisonPair.candidateACode) ?? "Sin dato")}`
      : "A: Sin dato",
    candidateB: comparisonPair
      ? `B: ${formatTitleCase(comparisonOptionLabels.get(comparisonPair.candidateBCode) ?? "Sin dato")}`
      : "B: Sin dato",
    comparisonMode: comparisonMode === "projected" ? "Proyectado" : "Actual ONPE",
    others: showOthers ? "Otros On" : "Otros Off"
  };

  return {
    comparisonMode,
    comparisonPair,
    comparisonCandidateOptions,
    comparisonOptionLabels,
    comparisonInvalidSelector,
    comparisonNotice,
    comparisonNoticeClassName,
    showOthers,
    mobileSummary,
    handleComparisonCandidateChange,
    handleComparisonModeChange,
    handleShowOthersToggle,
    handleGlobalReset
  };
}
