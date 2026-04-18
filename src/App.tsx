import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { fetchSnapshot, refreshSnapshot } from "./lib/api";
import {
  initializeAnalytics,
  trackEvent,
  trackInitialPageView
} from "./lib/analytics";
import {
  buildSecondRoundInsight,
  buildNationalComparisonItems,
  buildScopeComparisonItem,
  getScopeSecondRoundGapVotes,
  type ComparisonItem,
  type ComparisonMode,
  type SecondRoundStatusLevel
} from "./lib/comparison";
import { getCandidateColor } from "./lib/constants";
import {
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

type SortKey =
  | "electores"
  | "actas"
  | "participacion"
  | "candidate"
  | "projection"
  | "gap_2v3";
type AnalysisMode = "second_round" | "candidate";
type LeafScopeResult = ProvinceResult | ForeignCountryResult;
type ComparableScope = ScopeResult | ProvinceResult | ForeignCountryResult;

const DEFAULT_ANALYSIS_MODE: AnalysisMode = "second_round";
const DEFAULT_COMPARISON_MODE: ComparisonMode = "projected";
const DEFAULT_SHOW_OTHERS = false;
const DEFAULT_REGION_SORT: SortKey = "gap_2v3";

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

function getStatusCopy(statusLevel: SecondRoundStatusLevel) {
  switch (statusLevel) {
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

function resolveSecondRoundStatusLevel(gapPp2v3: number | null): SecondRoundStatusLevel {
  if (gapPp2v3 === null) {
    return "unknown";
  }

  if (gapPp2v3 < 0.5) {
    return "very_tight";
  }

  if (gapPp2v3 < 1.5) {
    return "tight";
  }

  return "stable";
}

function buildCurrentSecondRoundInsight(snapshot: ElectionSnapshot) {
  const currentVotesByCode = new Map<string, { votes: number; label: string }>();
  const hasFullNationalCandidates = snapshot.national.candidates.length > 0;
  const hasFullForeignCandidates = snapshot.foreign.candidates.length > 0;
  // Keep a single source strategy across scopes to avoid mixing full and featured data.
  const useFullCandidates = hasFullNationalCandidates && hasFullForeignCandidates;
  const nationalCandidates = useFullCandidates
    ? snapshot.national.candidates
    : snapshot.national.featuredCandidates;
  const foreignCandidates = useFullCandidates
    ? snapshot.foreign.candidates
    : snapshot.foreign.featuredCandidates;

  for (const candidate of [...nationalCandidates, ...foreignCandidates]) {
    if (candidate.code === "otros") {
      continue;
    }

    const currentEntry = currentVotesByCode.get(candidate.code);
    currentVotesByCode.set(candidate.code, {
      votes: (currentEntry?.votes ?? 0) + candidate.votesValid,
      label: currentEntry?.label ?? candidate.candidateName
    });
  }

  const totalCurrentValidVotes =
    snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos;
  const rankedEntries = Array.from(currentVotesByCode.entries())
    .map(([code, entry]) => ({
      code,
      label: entry.label,
      votes: entry.votes,
      percentage: totalCurrentValidVotes > 0 ? (entry.votes / totalCurrentValidVotes) * 100 : 0
    }))
    .sort((left, right) => {
      if (right.votes !== left.votes) {
        return right.votes - left.votes;
      }

      return right.percentage - left.percentage;
    });

  const rank2 = rankedEntries[1] ?? null;
  const rank3 = rankedEntries[2] ?? null;
  const gapVotes2v3 = rank2 && rank3 ? rank2.votes - rank3.votes : null;
  const rawGapPp2v3 = rank2 && rank3 ? rank2.percentage - rank3.percentage : null;
  const gapPp2v3 = rawGapPp2v3 != null ? Number(rawGapPp2v3.toFixed(6)) : null;

  return {
    rank2,
    rank3,
    gapVotes2v3,
    gapPp2v3,
    statusLevel: resolveSecondRoundStatusLevel(gapPp2v3)
  };
}

function getScopeProjectedTotalVotes(scope: ComparableScope) {
  const projectedVotesTotal = Object.values(scope.projectedVotes).reduce((sum, votes) => sum + votes, 0);
  const fallbackProjectedVotes = scope.candidates.reduce((sum, candidate) => {
    if (candidate.code === "otros" || typeof scope.projectedVotes[candidate.code] === "number") {
      return sum;
    }

    if (scope.actasContabilizadasPct <= 0) {
      return sum;
    }

    return sum + Math.round(candidate.votesValid / (scope.actasContabilizadasPct / 100));
  }, 0);

  return projectedVotesTotal + fallbackProjectedVotes;
}

function getScopeProjectedVotesByCode(scope: ComparableScope, code: string) {
  const projectedFromScope = scope.projectedVotes[code];
  if (typeof projectedFromScope === "number") {
    return projectedFromScope;
  }

  if (scope.actasContabilizadasPct <= 0) {
    return 0;
  }

  const candidate = scope.candidates.find((item) => item.code === code);
  if (!candidate) {
    return 0;
  }

  return Math.round(candidate.votesValid / (scope.actasContabilizadasPct / 100));
}

function getScopeActualVotesByCode(scope: ComparableScope, code: string) {
  if (code === "otros") {
    return scope.otros.votesValid;
  }

  const candidate =
    scope.candidates.find((item) => item.code === code) ??
    scope.featuredCandidates.find((item) => item.code === code);

  return candidate?.votesValid ?? 0;
}

function getScopeSecondRoundGap(
  scope: ComparableScope,
  secondRoundCodes: { rank2Code: string; rank3Code: string } | null,
  comparisonMode: ComparisonMode
) {
  if (!secondRoundCodes) {
    return null;
  }

  const projectedGapVotes = getScopeSecondRoundGapVotes(
    scope,
    secondRoundCodes.rank2Code,
    secondRoundCodes.rank3Code
  );
  const rank2Votes =
    comparisonMode === "projected"
      ? projectedGapVotes + getScopeProjectedVotesByCode(scope, secondRoundCodes.rank3Code)
      : getScopeActualVotesByCode(scope, secondRoundCodes.rank2Code);
  const rank3Votes =
    comparisonMode === "projected"
      ? getScopeProjectedVotesByCode(scope, secondRoundCodes.rank3Code)
      : getScopeActualVotesByCode(scope, secondRoundCodes.rank3Code);
  const totalVotes =
    comparisonMode === "projected" ? getScopeProjectedTotalVotes(scope) : scope.totalVotosValidos;
  const gapVotes = rank2Votes - rank3Votes;
  const gapPercentage = totalVotes > 0 ? Number(((gapVotes / totalVotes) * 100).toFixed(3)) : 0;

  return {
    gapVotes,
    gapPercentage
  };
}

function getScopeComparisonVotes(
  scope: ComparableScope,
  analysisMode: AnalysisMode,
  selectedCode: string,
  comparisonMode: ComparisonMode,
  secondRoundCodes: { rank2Code: string; rank3Code: string } | null
) {
  if (analysisMode === "second_round") {
    return getScopeSecondRoundGap(scope, secondRoundCodes, comparisonMode)?.gapVotes ?? 0;
  }

  const comparison = buildScopeComparisonItem(scope, selectedCode);
  return comparisonMode === "projected" ? comparison.projectedVotes : comparison.actualVotes;
}

function QuickInsightsSkeleton() {
  return (
    <section className="quick-insights quick-insights--loading" aria-label="Cargando resumen rápido">
      <div className="quick-insights__header">
        <div className="quick-insights__header-main">
          <p className="eyebrow">Resumen clave: segunda vuelta</p>
          <h2>Resumen clave: segunda vuelta</h2>
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

function sortRegions(
  regions: RegionResult[],
  selectedCode: string,
  sortKey: SortKey,
  analysisMode: AnalysisMode,
  comparisonMode: ComparisonMode,
  secondRoundCodes: { rank2Code: string; rank3Code: string } | null
) {
  const sorted = [...regions];
  const getGapSortValue = (scope: RegionResult) =>
    getScopeSecondRoundGap(scope, secondRoundCodes, comparisonMode)?.gapVotes ?? Number.MAX_SAFE_INTEGER;

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "electores":
        return right.electores - left.electores;
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "candidate": {
        if (analysisMode === "second_round") {
          const leftGap = getGapSortValue(left);
          const rightGap = getGapSortValue(right);
          if (leftGap === rightGap) {
            return right.electores - left.electores;
          }

          return leftGap - rightGap;
        }

        const leftCandidate = left.featuredCandidates.find((candidate) => candidate.code === selectedCode);
        const rightCandidate = right.featuredCandidates.find((candidate) => candidate.code === selectedCode);
        return (rightCandidate?.pctValid ?? 0) - (leftCandidate?.pctValid ?? 0);
      }
      case "gap_2v3": {
        const leftGap = getGapSortValue(left);
        const rightGap = getGapSortValue(right);

        if (leftGap === rightGap) {
          return right.electores - left.electores;
        }

        return leftGap - rightGap;
      }
      case "projection":
        if (analysisMode === "second_round") {
          const leftGap = getGapSortValue(left);
          const rightGap = getGapSortValue(right);
          if (leftGap === rightGap) {
            return right.electores - left.electores;
          }

          return leftGap - rightGap;
        }

        return (right.projectedVotes[selectedCode] ?? 0) - (left.projectedVotes[selectedCode] ?? 0);
      default:
        return 0;
    }
  });

  return sorted;
}

function sortLeafScopes(
  scopes: LeafScopeResult[],
  analysisMode: AnalysisMode,
  selectedCode: string,
  comparisonMode: ComparisonMode,
  secondRoundCodes: { rank2Code: string; rank3Code: string } | null
) {
  const sorted = [...scopes];

  sorted.sort((left, right) => {
    if (analysisMode === "second_round") {
      const leftGap =
        getScopeSecondRoundGap(left, secondRoundCodes, comparisonMode)?.gapVotes ?? Number.MAX_SAFE_INTEGER;
      const rightGap =
        getScopeSecondRoundGap(right, secondRoundCodes, comparisonMode)?.gapVotes ?? Number.MAX_SAFE_INTEGER;

      if (leftGap === rightGap) {
        return right.totalVotosValidos - left.totalVotosValidos;
      }

      return leftGap - rightGap;
    }

    const leftVotes = getScopeComparisonVotes(
      left,
      analysisMode,
      selectedCode,
      comparisonMode,
      secondRoundCodes
    );
    const rightVotes = getScopeComparisonVotes(
      right,
      analysisMode,
      selectedCode,
      comparisonMode,
      secondRoundCodes
    );

    return rightVotes - leftVotes;
  });

  return sorted;
}

function sortForeignContinents(
  continents: ForeignContinentResult[],
  analysisMode: AnalysisMode,
  selectedCode: string,
  comparisonMode: ComparisonMode,
  secondRoundCodes: { rank2Code: string; rank3Code: string } | null
) {
  const sorted = [...continents];

  sorted.sort((left, right) => {
    if (analysisMode === "second_round") {
      const leftGap =
        getScopeSecondRoundGap(left, secondRoundCodes, comparisonMode)?.gapVotes ?? Number.MAX_SAFE_INTEGER;
      const rightGap =
        getScopeSecondRoundGap(right, secondRoundCodes, comparisonMode)?.gapVotes ?? Number.MAX_SAFE_INTEGER;

      if (leftGap === rightGap) {
        return right.totalVotosValidos - left.totalVotosValidos;
      }

      return leftGap - rightGap;
    }

    const leftVotes = getScopeComparisonVotes(
      left,
      analysisMode,
      selectedCode,
      comparisonMode,
      secondRoundCodes
    );
    const rightVotes = getScopeComparisonVotes(
      right,
      analysisMode,
      selectedCode,
      comparisonMode,
      secondRoundCodes
    );

    return rightVotes - leftVotes;
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
  analysisMode,
  selectedCode,
  showOthers,
  comparisonMode,
  secondRoundCodes
}: {
  titleEyebrow: string;
  scopeLabel: string;
  itemSingularLabel: string;
  itemPluralLabel: string;
  recompositionLabel: string;
  scopes: LeafScopeResult[];
  analysisMode: AnalysisMode;
  selectedCode: string;
  showOthers: boolean;
  comparisonMode: ComparisonMode;
  secondRoundCodes: { rank2Code: string; rank3Code: string } | null;
}) {
  const comparisonLabel =
    analysisMode === "second_round"
      ? `Brecha 2do vs 3ro (${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"})`
      : comparisonMode === "projected"
        ? "Proyección seleccionada"
        : "Actual seleccionado";
  const sortedScopes = sortLeafScopes(
    scopes,
    analysisMode,
    selectedCode,
    comparisonMode,
    secondRoundCodes
  );

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
          const secondRoundGap = getScopeSecondRoundGap(scope, secondRoundCodes, comparisonMode);
          const hasSecondRoundGap = Boolean(secondRoundGap);
          const comparisonVotes =
            analysisMode === "second_round"
              ? secondRoundGap?.gapVotes ?? 0
              : comparisonMode === "projected"
                ? selectedComparison.projectedVotes
                : selectedComparison.actualVotes;
          const comparisonPercentage =
            analysisMode === "second_round"
              ? secondRoundGap?.gapPercentage ?? 0
              : comparisonMode === "projected"
                ? selectedComparison.projectedPercentage
                : selectedComparison.actualPercentage;
          const comparisonDetail =
            analysisMode === "second_round"
              ? `${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"} · 2do vs 3ro`
              : `${formatTitleCase(selectedComparison.label)} · ${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"}`;

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
                  <strong>
                    {analysisMode === "second_round"
                      ? hasSecondRoundGap
                        ? formatSignedNumber(comparisonVotes)
                        : "Sin dato"
                      : formatNumber(comparisonVotes)}
                  </strong>
                  <span>
                    {analysisMode === "second_round"
                      ? hasSecondRoundGap
                        ? `${formatSignedDecimal(comparisonPercentage, 2)} pp`
                        : "Sin dato"
                      : formatPercent(comparisonPercentage, 2)}
                  </span>
                  <small>
                    {comparisonDetail}
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
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_REGION_SORT);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(DEFAULT_ANALYSIS_MODE);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(DEFAULT_COMPARISON_MODE);
  const [selectedCandidateCode, setSelectedCandidateCode] = useState<string>("");
  const [showOthers, setShowOthers] = useState(DEFAULT_SHOW_OTHERS);
  const [regionSearchQuery, setRegionSearchQuery] = useState("");
  const [foreignSearchQuery, setForeignSearchQuery] = useState("");
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [expandedContinentId, setExpandedContinentId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileControlsSticky, setIsMobileControlsSticky] = useState(false);
  const [isMobileControlsCollapsed, setIsMobileControlsCollapsed] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const candidateSelectRef = useRef<HTMLSelectElement | null>(null);
  const globalControlsRef = useRef<HTMLElement | null>(null);
  const lastAutoRefreshKeyRef = useRef<string | null>(null);
  const quickInsightsImpressionRef = useRef<string | null>(null);
  const globalControlsImpressionRef = useRef<string | null>(null);
  const analysisModeDefaultRef = useRef<string | null>(null);
  const quickInsightsStatusRef = useRef<string | null>(null);
  const quickInsightsContextRef = useRef<string | null>(null);
  const previousMobileStickyRef = useRef(false);
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
    function syncMobileControlsState() {
      const isMobile = window.innerWidth <= 640;
      const isSticky =
        isMobile && globalControlsRef.current
          ? globalControlsRef.current.getBoundingClientRect().top <= 8
          : false;

      setIsMobileViewport(isMobile);
      setIsMobileControlsSticky(isSticky);

      if (!isMobile || !isSticky) {
        setIsMobileControlsCollapsed(false);
      } else if (!previousMobileStickyRef.current && isSticky) {
        setIsMobileControlsCollapsed(true);
      }

      previousMobileStickyRef.current = isSticky;
    }

    syncMobileControlsState();
    window.addEventListener("scroll", syncMobileControlsState, { passive: true });
    window.addEventListener("resize", syncMobileControlsState);

    return () => {
      window.removeEventListener("scroll", syncMobileControlsState);
      window.removeEventListener("resize", syncMobileControlsState);
    };
  }, []);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setSelectedCandidateCode((currentCode) => {
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

  const secondRoundInsight = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return buildSecondRoundInsight(snapshot);
  }, [snapshot]);
  const currentSecondRoundInsight = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return buildCurrentSecondRoundInsight(snapshot);
  }, [snapshot]);

  const secondRoundCodes = useMemo(() => {
    if (!secondRoundInsight?.rank2 || !secondRoundInsight.rank3) {
      return null;
    }

    return {
      rank2Code: secondRoundInsight.rank2.code,
      rank3Code: secondRoundInsight.rank3.code
    };
  }, [secondRoundInsight]);

  const sortedRegions = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const orderedRegions = sortRegions(
      snapshot.regions,
      selectedCandidateCode,
      sortKey,
      analysisMode,
      comparisonMode,
      secondRoundCodes
    );
    const normalizedSearch = regionSearchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return orderedRegions;
    }

    return orderedRegions.filter((region) => region.label.toLowerCase().includes(normalizedSearch));
  }, [
    analysisMode,
    comparisonMode,
    secondRoundCodes,
    selectedCandidateCode,
    snapshot,
    sortKey,
    regionSearchQuery
  ]);

  const sortedContinents = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const orderedContinents = sortForeignContinents(
      foreignContinents,
      analysisMode,
      selectedCandidateCode,
      comparisonMode,
      secondRoundCodes
    );
    const normalizedSearch = foreignSearchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return orderedContinents;
    }

    return orderedContinents.flatMap((continent) => {
      const continentMatches = continent.label.toLowerCase().includes(normalizedSearch);
      const matchingCountries =
        continent.countries?.filter((country) =>
          country.label.toLowerCase().includes(normalizedSearch)
        ) ?? [];

      if (!continentMatches && matchingCountries.length === 0) {
        return [];
      }

      return [
        {
          ...continent,
          countries: continentMatches ? continent.countries : matchingCountries
        }
      ];
    });
  }, [
    analysisMode,
    comparisonMode,
    foreignContinents,
    foreignSearchQuery,
    secondRoundCodes,
    selectedCandidateCode,
    snapshot
  ]);

  const nationalComparisonItems = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return buildNationalComparisonItems(snapshot);
  }, [snapshot]);

  const featuredComparisonBars = useMemo(() => {
    const featuredBars = nationalComparisonItems.filter((item) => item.code !== "otros");

    if (analysisMode === "candidate") {
      return featuredBars.filter((item) => item.code === selectedCandidateCode);
    }

    if (!secondRoundCodes) {
      return featuredBars;
    }

    return featuredBars.filter(
      (item) => item.code === secondRoundCodes.rank2Code || item.code === secondRoundCodes.rank3Code
    );
  }, [analysisMode, nationalComparisonItems, secondRoundCodes, selectedCandidateCode]);

  const othersBar = snapshot
    ? nationalComparisonItems.find((item) => item.code === "otros") ?? null
    : null;
  const canUseSecondRoundMode = Boolean(secondRoundCodes);
  const selectedComparisonLabel =
    analysisMode === "second_round"
      ? `Brecha 2do vs 3ro (${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"})`
      : comparisonMode === "projected"
        ? "Proyección seleccionada"
        : "Actual seleccionado";
  const quickInsightsTrackingBase = {
    gap_pp_2v3: secondRoundInsight?.gapPp2v3 ?? undefined,
    gap_votes_2v3: secondRoundInsight?.gapVotes2v3 ?? undefined,
    rank2_candidate: secondRoundInsight?.rank2?.label ?? undefined,
    rank3_candidate: secondRoundInsight?.rank3?.label ?? undefined,
    snapshot_generated_at: snapshot?.generatedAt ?? undefined
  };

  useEffect(() => {
    if (!snapshot || !secondRoundInsight) {
      return;
    }

    if (quickInsightsImpressionRef.current === snapshot.generatedAt) {
      return;
    }

    trackEvent("quick_insights_impression", quickInsightsTrackingBase);
    quickInsightsImpressionRef.current = snapshot.generatedAt;
  }, [quickInsightsTrackingBase, secondRoundInsight, snapshot]);

  useEffect(() => {
    if (!snapshot || !secondRoundInsight) {
      return;
    }

    if (quickInsightsStatusRef.current === snapshot.generatedAt) {
      return;
    }

    trackEvent("second_round_status_shown", {
      status_level: secondRoundInsight.statusLevel,
      gap_pp_2v3: secondRoundInsight.gapPp2v3 ?? undefined,
      snapshot_generated_at: snapshot.generatedAt
    });
    quickInsightsStatusRef.current = snapshot.generatedAt;
  }, [secondRoundInsight, snapshot]);

  useEffect(() => {
    if (!snapshot || !secondRoundInsight) {
      return;
    }

    if (quickInsightsContextRef.current === snapshot.generatedAt) {
      return;
    }

    trackEvent("second_round_context_shown", {
      actas_peru: secondRoundInsight.actasPeruPct,
      actas_exterior: secondRoundInsight.actasExteriorPct,
      delta_proyeccion: secondRoundInsight.deltaProyeccionVotes,
      snapshot_generated_at: snapshot.generatedAt
    });
    quickInsightsContextRef.current = snapshot.generatedAt;
  }, [secondRoundInsight, snapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (globalControlsImpressionRef.current === snapshot.generatedAt) {
      return;
    }

    trackEvent("global_controls_impression", {
      analysis_mode: analysisMode,
      comparison_mode: comparisonMode,
      show_others: showOthers,
      snapshot_generated_at: snapshot.generatedAt
    });
    globalControlsImpressionRef.current = snapshot.generatedAt;
  }, [analysisMode, comparisonMode, showOthers, snapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (analysisModeDefaultRef.current === snapshot.generatedAt) {
      return;
    }

    const defaultMode: AnalysisMode = canUseSecondRoundMode ? DEFAULT_ANALYSIS_MODE : "candidate";

    if (!canUseSecondRoundMode) {
      setAnalysisMode("candidate");
    }

    trackEvent("analysis_mode_default_applied", {
      analysis_mode: defaultMode,
      reason: canUseSecondRoundMode ? "editorial_default" : "fallback_insufficient_data",
      snapshot_generated_at: snapshot.generatedAt
    });
    analysisModeDefaultRef.current = snapshot.generatedAt;
  }, [canUseSecondRoundMode, snapshot]);

  useEffect(() => {
    if (analysisMode !== "candidate") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      candidateSelectRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [analysisMode]);

  function trackGlobalControlChange(
    controlName: "analysis_mode" | "comparison_mode" | "show_others" | "reset",
    previousValue: string | boolean,
    nextValue: string | boolean,
    source: "global_bar" | "quick_insight_cta" = "global_bar"
  ) {
    if (previousValue === nextValue) {
      return;
    }

    trackEvent("global_control_change", {
      control_name: controlName,
      previous_value: previousValue,
      next_value: nextValue,
      source,
      snapshot_generated_at: snapshot?.generatedAt
    });
  }

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

  function handleAnalysisModeChange(
    nextMode: AnalysisMode,
    source: "global_bar" | "quick_insight_cta" = "global_bar"
  ) {
    if (nextMode === "second_round" && !canUseSecondRoundMode) {
      return;
    }

    setAnalysisMode((currentMode) => {
      trackGlobalControlChange("analysis_mode", currentMode, nextMode, source);
      return nextMode;
    });
  }

  function handleComparisonModeChange(
    nextMode: ComparisonMode,
    source: "global_bar" | "quick_insight_cta" = "global_bar"
  ) {
    setComparisonMode((currentMode) => {
      trackGlobalControlChange("comparison_mode", currentMode, nextMode, source);
      return nextMode;
    });
  }

  function handleShowOthersToggle() {
    setShowOthers((currentValue) => {
      const nextValue = !currentValue;
      trackGlobalControlChange("show_others", currentValue, nextValue);

      return nextValue;
    });
  }

  function handleCandidateSelect(code: string, source: "global_bar" | "section_pill" = "global_bar") {
    setSelectedCandidateCode(code);
    trackEvent("select_candidate_focus", {
      candidate_code: code,
      source
    });
  }

  function handleGlobalReset() {
    const nextAnalysisMode: AnalysisMode = canUseSecondRoundMode ? DEFAULT_ANALYSIS_MODE : "candidate";
    trackGlobalControlChange("reset", "custom_state", "editorial_defaults");
    trackGlobalControlChange("analysis_mode", analysisMode, nextAnalysisMode);
    trackGlobalControlChange("comparison_mode", comparisonMode, DEFAULT_COMPARISON_MODE);
    trackGlobalControlChange("show_others", showOthers, DEFAULT_SHOW_OTHERS);
    setAnalysisMode(nextAnalysisMode);
    setComparisonMode(DEFAULT_COMPARISON_MODE);
    setShowOthers(DEFAULT_SHOW_OTHERS);
    setSortKey(DEFAULT_REGION_SORT);
  }

  function handleQuickInsightDetailClick() {
    handleAnalysisModeChange("second_round", "quick_insight_cta");
    handleComparisonModeChange("projected", "quick_insight_cta");
    trackEvent("quick_insight_detail_cta_click", {
      source: "quick_insights",
      section_target: "comparativa-central"
    });
  }

  function handleMobileControlsToggle() {
    setIsMobileControlsCollapsed((currentValue) => !currentValue);
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

  function handleHeroPrimaryCtaClick() {
    trackEvent("hero_primary_cta_click", {
      location: "hero",
      label: "explorar_regiones",
      section_target: "lectura-regional"
    });
  }

  function handleHeroSecondaryCtaClick() {
    trackEvent("hero_secondary_cta_click", {
      location: "hero",
      label: "ver_metodologia",
      section_target: "metodologia"
    });
  }

  function getScopeComparisonDisplay(scope: ComparableScope) {
    if (analysisMode === "second_round") {
      const secondRoundGap = getScopeSecondRoundGap(scope, secondRoundCodes, comparisonMode);

      if (!secondRoundGap) {
        return {
          votes: "Sin dato",
          percentage: "Sin dato",
          detail: `${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"} · 2do vs 3ro`
        };
      }

      return {
        votes: formatSignedNumber(secondRoundGap.gapVotes),
        percentage: `${formatSignedDecimal(secondRoundGap.gapPercentage, 2)} pp`,
        detail: `${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"} · 2do vs 3ro`
      };
    }

    const selectedComparison = buildScopeComparisonItem(scope, selectedCandidateCode);
    const comparisonVotes =
      comparisonMode === "projected"
        ? selectedComparison.projectedVotes
        : selectedComparison.actualVotes;
    const comparisonPercentage =
      comparisonMode === "projected"
        ? selectedComparison.projectedPercentage
        : selectedComparison.actualPercentage;

    return {
      votes: formatNumber(comparisonVotes),
      percentage: formatPercent(comparisonPercentage, 2),
      detail: `${formatTitleCase(selectedComparison.label)} · ${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"}`
    };
  }

  const hasSecondRoundInsight =
    Boolean(secondRoundInsight?.rank2) &&
    Boolean(secondRoundInsight?.rank3) &&
    secondRoundInsight?.gapPp2v3 != null &&
    secondRoundInsight?.gapVotes2v3 != null;
  const hasCurrentSecondRoundInsight =
    Boolean(currentSecondRoundInsight?.rank2) &&
    Boolean(currentSecondRoundInsight?.rank3) &&
    currentSecondRoundInsight?.gapPp2v3 != null &&
    currentSecondRoundInsight?.gapVotes2v3 != null;
  const statusCopy = getStatusCopy(secondRoundInsight?.statusLevel ?? "unknown");
  const currentStatusCopy = getStatusCopy(currentSecondRoundInsight?.statusLevel ?? "unknown");
  const rank2Value = secondRoundInsight?.rank2 ? formatTitleCase(secondRoundInsight.rank2.label) : null;
  const currentRank2Value = currentSecondRoundInsight?.rank2
    ? formatTitleCase(currentSecondRoundInsight.rank2.label)
    : null;
  const gapVotesValue =
    secondRoundInsight?.gapVotes2v3 != null
      ? `${formatSignedNumber(secondRoundInsight.gapVotes2v3)} votos`
      : null;
  const currentGapVotesValue =
    currentSecondRoundInsight?.gapVotes2v3 != null
      ? `${formatSignedNumber(currentSecondRoundInsight.gapVotes2v3)} votos`
      : null;
  const gapPpValue =
    secondRoundInsight?.gapPp2v3 != null
      ? `${secondRoundInsight.gapPp2v3.toFixed(2)} pp`
      : null;
  const currentGapPpValue =
    currentSecondRoundInsight?.gapPp2v3 != null
      ? `${currentSecondRoundInsight.gapPp2v3.toFixed(2)} pp`
      : null;
  const actasPeruValue = formatPercent(secondRoundInsight?.actasPeruPct ?? 0, 2);
  const actasExteriorValue = formatPercent(secondRoundInsight?.actasExteriorPct ?? 0, 2);
  const deltaProyeccionValue = formatSignedNumber(secondRoundInsight?.deltaProyeccionVotes ?? 0);
  const mobileAnalysisSummary =
    analysisMode === "second_round" ? "Brecha 2do vs 3ro" : "Candidato específico";
  const mobileCandidateSummary =
    analysisMode === "candidate"
      ? formatTitleCase(
          featuredLegend.find((candidate) => candidate.code === selectedCandidateCode)?.label ?? "Sin dato"
        )
      : null;
  const mobileComparisonSummary = comparisonMode === "projected" ? "Proyectado" : "Actual ONPE";
  const mobileOthersSummary = showOthers ? "Otros On" : "Otros Off";

  if (loading) {
    return (
      <main className="page-shell">
        <section className="hero hero--loading">
          <p className="eyebrow">Cargando snapshot</p>
          <h1>Preparando resultados y proyección nacional…</h1>
        </section>
        <QuickInsightsSkeleton />
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
          <p className="eyebrow">Resultados presidenciales 2026</p>
          <h1>Conteo de votos y proyección nacional</h1>
          <p className="hero__lede">
            Consulta resultados ONPE, compara candidatos y explora regiones y votos extranjeros con datos
            actualizados.
          </p>
          <div className="hero__actions">
            <a
              className="hero__cta hero__cta--primary"
              href="#lectura-regional"
              onClick={handleHeroPrimaryCtaClick}
            >
              Explorar regiones
            </a>
            <a
              className="hero__cta hero__cta--secondary"
              href="#metodologia"
              onClick={handleHeroSecondaryCtaClick}
            >
              Ver metodología
            </a>
          </div>
          <p className="hero__microcopy">
            Actualizamos esta vista con nuevos cortes oficiales de ONPE.
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
          <div id="estado-actualizacion">
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

      <section className="quick-insights" aria-labelledby="quick-insights-title">
        <div className="quick-insights__header">
          <div className="quick-insights__header-main">
            <p className="eyebrow">Resumen rápido</p>
            <h2 id="quick-insights-title">Resumen clave: segunda vuelta</h2>
            <p>
              Quién está entrando hoy a segunda vuelta y qué tan ajustada es la pelea por el 2do cupo.
            </p>
          </div>
          <div
            className="quick-insights__chips quick-insights__chips--header"
            aria-label="Contexto mínimo de conteo y proyección"
          >
            <span className="quick-insight-chip">Actas Perú: {actasPeruValue}</span>
            <span className="quick-insight-chip">Actas exterior: {actasExteriorValue}</span>
            <span className="quick-insight-chip">Delta proyección: {deltaProyeccionValue} votos</span>
          </div>
        </div>
        <div className="quick-insights__actions">
          <a
            className="quick-insights__cta"
            href="#comparativa-central"
            onClick={handleQuickInsightDetailClick}
          >
            Ver detalle 2do vs 3ro
          </a>
        </div>

        <div className="quick-insights__matrix" aria-label="Comparativa actual y proyectada del corte a segunda vuelta">
          <div className="quick-insights__matrix-head" aria-hidden="true">
            <span />
            <p>Hoy clasifica a segunda vuelta</p>
            <p>Brecha porcentual (2do - 3ro)</p>
            <p>Diferencia en votos (2do - 3ro)</p>
          </div>

          <div className="quick-insights__matrix-row">
            <p className="quick-insights__row-label">Actual ONPE</p>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">Hoy clasifica a segunda vuelta</p>
              <strong>{currentRank2Value ?? "Insight no disponible"}</strong>
            </article>
            <article className="quick-insight-kpi">
              <div className="quick-insight-kpi__heading">
                <p className="quick-insight-kpi__mobile-label">Brecha porcentual (2do - 3ro)</p>
                {hasCurrentSecondRoundInsight ? (
                  <span className={currentStatusCopy.className}>
                    {currentStatusCopy.label}
                  </span>
                ) : null}
              </div>
              <strong>{currentGapPpValue ?? "Insight no disponible"}</strong>
            </article>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">Diferencia en votos (2do - 3ro)</p>
              <strong>{currentGapVotesValue ?? "Insight no disponible"}</strong>
            </article>
          </div>

          <div className="quick-insights__matrix-row">
            <p className="quick-insights__row-label">Proyección total</p>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">Hoy clasifica a segunda vuelta</p>
              <strong>{rank2Value ?? "Insight no disponible"}</strong>
            </article>
            <article className="quick-insight-kpi">
              <div className="quick-insight-kpi__heading">
                <p className="quick-insight-kpi__mobile-label">Brecha porcentual (2do - 3ro)</p>
                {hasSecondRoundInsight ? (
                  <span className={statusCopy.className}>
                    {statusCopy.label}
                  </span>
                ) : null}
              </div>
              <strong>{gapPpValue ?? "Insight no disponible"}</strong>
            </article>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">Diferencia en votos (2do - 3ro)</p>
              <strong>{gapVotesValue ?? "Insight no disponible"}</strong>
            </article>
          </div>
        </div>
      </section>

      <section
        ref={globalControlsRef}
        className={`global-controls ${isMobileControlsSticky ? "is-mobile-sticky" : ""} ${isMobileControlsCollapsed ? "is-collapsed" : ""}`}
        aria-label="Controles globales"
      >
        {isMobileViewport && isMobileControlsSticky ? (
          <div className="global-controls__mobile-summary">
            <div className="global-controls__mobile-summary-text">
              <span>{mobileAnalysisSummary}</span>
              {mobileCandidateSummary ? <span>{mobileCandidateSummary}</span> : null}
              <span>{mobileComparisonSummary}</span>
              <span>{mobileOthersSummary}</span>
            </div>
            <button
              className="global-controls__mobile-toggle"
              type="button"
              aria-expanded={!isMobileControlsCollapsed}
              aria-label={isMobileControlsCollapsed ? "Expandir filtros" : "Colapsar filtros"}
              onClick={handleMobileControlsToggle}
            >
              <span
                className={`global-controls__mobile-toggle-icon ${isMobileControlsCollapsed ? "is-collapsed" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : null}

        <div className="global-controls__row">
          <div className="control">
            <span>Analizar</span>
            <select
              className="global-controls__select"
              aria-label="Analizar"
              value={analysisMode}
              onChange={(event) => handleAnalysisModeChange(event.target.value as AnalysisMode)}
            >
              <option value="second_round" disabled={!canUseSecondRoundMode}>
                Brecha 2do vs 3ro
              </option>
              <option value="candidate">Candidato específico</option>
            </select>
            {!canUseSecondRoundMode ? (
              <small className="global-controls__notice">
                Sin data suficiente para 2do vs 3ro en este corte.
              </small>
            ) : null}
          </div>

          {analysisMode === "candidate" ? (
            <div className="control control--candidate">
              <span>Candidato</span>
              <select
                ref={candidateSelectRef}
                className="global-controls__select"
                aria-label="Candidato"
                value={selectedCandidateCode}
                onChange={(event) => handleCandidateSelect(event.target.value)}
              >
                {featuredLegend.map((candidate) => (
                  <option key={candidate.code} value={candidate.code}>
                    {formatTitleCase(candidate.label)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="control">
            <span>Comparar</span>
            <select
              className="global-controls__select"
              aria-label="Comparar"
              value={comparisonMode}
              onChange={(event) => handleComparisonModeChange(event.target.value as ComparisonMode)}
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
              onClick={handleShowOthersToggle}
            >
              {showOthers ? "On" : "Off"}
            </button>
          </div>

          <div className="control control--compact">
            <span>Reset</span>
            <button className="toggle-button" type="button" onClick={handleGlobalReset}>
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
      </section>

      <section className="content-grid">
        <section className="panel" id="comparativa-central">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Comparativa central</p>
              <h2>
                {analysisMode === "second_round"
                  ? "Disputa por el 2do cupo, total elección"
                  : "Candidato en foco + Otros, total elección"}
              </h2>
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

        <section className="panel" id="lectura-regional">
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
                  <option value="gap_2v3">Brecha 2do vs 3ro</option>
                  <option value="electores">Electores</option>
                  <option value="actas">Actas</option>
                  <option value="participacion">Participación</option>
                  {analysisMode === "candidate" ? <option value="projection">Proyección</option> : null}
                  {analysisMode === "candidate" ? <option value="candidate">Candidato</option> : null}
                </select>
              </label>
              <label className="control">
                <span>Buscar región</span>
                <input
                  type="search"
                  value={regionSearchQuery}
                  onInput={(event) =>
                    setRegionSearchQuery((event.target as HTMLInputElement).value)
                  }
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
                {sortedRegions.map((region) => {
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
                            <strong>{comparisonDisplay.votes}</strong>
                            <span>{comparisonDisplay.percentage}</span>
                            <small>
                              {comparisonDisplay.detail}
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
                              analysisMode={analysisMode}
                              selectedCode={selectedCandidateCode}
                              showOthers={showOthers}
                              comparisonMode={comparisonMode}
                              secondRoundCodes={secondRoundCodes}
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
                  onInput={(event) =>
                    setForeignSearchQuery((event.target as HTMLInputElement).value)
                  }
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
                {sortedContinents.map((continent) => {
                  const isExpanded = expandedContinentId === continent.scopeId;
                  const comparisonDisplay = getScopeComparisonDisplay(continent);

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
                            <strong>{comparisonDisplay.votes}</strong>
                            <span>{comparisonDisplay.percentage}</span>
                            <small>
                              {comparisonDisplay.detail}
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
                              analysisMode={analysisMode}
                              selectedCode={selectedCandidateCode}
                              showOthers={showOthers}
                              comparisonMode={comparisonMode}
                              secondRoundCodes={secondRoundCodes}
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

        <section className="panel methodology-panel" id="metodologia">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Metodología</p>
              <h2>Cómo se calcula la proyección</h2>
            </div>
          </div>
          <p>
            Mostramos resultados oficiales de ONPE y una estimación nacional de votos de acuerdo al avance del escrutinio. La aplicación emplea un modelo de <strong>extrapolación lineal por actas contabilizadas</strong> (no actas procesadas):
          </p>
          <ul>
            <li>
              <strong>Extrapolación local:</strong> Al estimar las actas faltantes en una circunscripción, se asume matemáticamente que mantendrán la composición de los votos ya escrutados (<code>Votos Proyectados = Votos Actuales / % avance de actas contabilizadas</code>). En caso se tengan 0 actas contabilizadas, la proyección es cero.
            </li>
            <li>
              <strong>Agregación bottom-up:</strong> Para mitigar inconsistencias de velocidades agregadas, la proyección total se calcula de forma descentralizada sumando de forma independiente la proyección de cada bloque geográfico mayor (las 25 regiones y el total consolidado de los peruanos en el extranjero).
            </li>
            <li>
              <strong>Consideraciones clave:</strong> El modelo puede presentar variaciones con el avance del tiempo y no debe considerarse como dato definitivo. Esto ocurre porque el método no corrige por sesgo geográfico intrínseco: los votos remanentes (por ejemplo, actas rurales que tardan más en ser trasladadas a centros de cómputo) pueden exhibir un patrón estadísticamemte diferente frente al voto predominantemente urbano contado al inicio de la jornada.
            </li>
          </ul>
        </section>
      </section>
    </main>
  );
}
