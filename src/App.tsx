import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { fetchAppData, refreshAppData } from "./lib/api";
import {
  initializeAnalytics,
  trackEvent,
  trackInitialPageView
} from "./lib/analytics";
import {
  buildComparisonCandidateOptions,
  buildNationalComparisonPairItems,
  buildScopeComparisonItem,
  getScopeComparisonGap,
  reconcileComparisonPair,
  resolveDefaultComparisonPair,
  type ComparisonCandidateOption,
  type ComparisonItem,
  type ComparisonMode,
  type ComparisonPair
} from "./lib/comparison";
import { getCandidateColor } from "./lib/constants";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeMinutes,
  formatSignedDecimal,
  formatSignedNumber,
  formatTime,
  formatTitleCase
} from "./lib/format";
import {
  deriveAppFreshnessStatus,
  getAppFetchAgeMinutes,
  getNextAutoRefreshInMinutes,
  getSourceAgeMinutes,
  getSourceHasNewCut,
  shouldAutoRefresh,
  type AppFreshnessStatus
} from "./lib/trust";
import type {
  ElectionSnapshot,
  ForeignContinentResult,
  ForeignCountryResult,
  HealthStatus,
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
type LeafScopeResult = ProvinceResult | ForeignCountryResult;
type ComparableScope = ScopeResult | ProvinceResult | ForeignCountryResult;

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

function getComparisonColumnLabel(comparisonMode: ComparisonMode) {
  return `Brecha A vs B (${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"})`;
}

function getPairLabelByCode(options: ComparisonCandidateOption[]) {
  return new Map(options.map((candidate) => [candidate.code, candidate.label]));
}

function getComparisonPairDetail(
  pair: ComparisonPair,
  labelByCode: Map<string, string>,
  comparisonMode: ComparisonMode
) {
  const labelA = formatTitleCase(labelByCode.get(pair.candidateACode) ?? "Sin dato");
  const labelB = formatTitleCase(labelByCode.get(pair.candidateBCode) ?? "Sin dato");

  return `${labelA} vs ${labelB} · ${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"}`;
}

function sortRegions(
  regions: RegionResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  const sorted = [...regions];
  const getGapSortValue = (scope: RegionResult) =>
    getScopeComparisonGap(scope, comparisonPair, comparisonMode).gapVotes;

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "electores":
        return right.electores - left.electores;
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "candidate": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);
        if (rightCandidate.actualPercentage === leftCandidate.actualPercentage) {
          return right.electores - left.electores;
        }

        return rightCandidate.actualPercentage - leftCandidate.actualPercentage;
      }
      case "projection": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);
        if (rightCandidate.projectedVotes === leftCandidate.projectedVotes) {
          return right.electores - left.electores;
        }

        return rightCandidate.projectedVotes - leftCandidate.projectedVotes;
      }
      case "gap_2v3":
      default: {
        const leftGap = getGapSortValue(left);
        const rightGap = getGapSortValue(right);

        if (leftGap === rightGap) {
          return right.electores - left.electores;
        }

        return leftGap - rightGap;
      }
    }
  });

  return sorted;
}

function sortLeafScopes(
  scopes: LeafScopeResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  const sorted = [...scopes];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "candidate": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.actualPercentage === leftCandidate.actualPercentage) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.actualPercentage - leftCandidate.actualPercentage;
      }
      case "projection": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.projectedVotes === leftCandidate.projectedVotes) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.projectedVotes - leftCandidate.projectedVotes;
      }
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "gap_2v3":
      case "electores":
      default: {
        const leftGap = getScopeComparisonGap(left, comparisonPair, comparisonMode).gapVotes;
        const rightGap = getScopeComparisonGap(right, comparisonPair, comparisonMode).gapVotes;

        if (leftGap === rightGap) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return leftGap - rightGap;
      }
    }
  });

  return sorted;
}

function sortForeignContinents(
  continents: ForeignContinentResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  const sorted = [...continents];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "candidate": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.actualPercentage === leftCandidate.actualPercentage) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.actualPercentage - leftCandidate.actualPercentage;
      }
      case "projection": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.projectedVotes === leftCandidate.projectedVotes) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.projectedVotes - leftCandidate.projectedVotes;
      }
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "gap_2v3":
      case "electores":
      default: {
        const leftGap = getScopeComparisonGap(left, comparisonPair, comparisonMode).gapVotes;
        const rightGap = getScopeComparisonGap(right, comparisonPair, comparisonMode).gapVotes;

        if (leftGap === rightGap) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return leftGap - rightGap;
      }
    }
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
                <div className="comparison-cell">
                  <strong>{formatSignedNumber(comparisonGap.gapVotes)}</strong>
                  <span>{`${formatSignedDecimal(comparisonGap.gapPercentage, 2)} pp`}</span>
                  <small>
                    {getComparisonPairDetail(comparisonPair, comparisonOptionLabels, comparisonMode)}
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

function QuickInsightsSkeleton() {
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

export default function App() {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_REGION_SORT);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(DEFAULT_COMPARISON_MODE);
  const [comparisonPair, setComparisonPair] = useState<ComparisonPair | null>(null);
  const [comparisonValidationMessage, setComparisonValidationMessage] = useState<string | null>(null);
  const [comparisonInvalidSelector, setComparisonInvalidSelector] = useState<"candidate_a" | "candidate_b" | null>(null);
  const [comparisonAdjustmentMessage, setComparisonAdjustmentMessage] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(DEFAULT_SHOW_OTHERS);
  const [regionSearchQuery, setRegionSearchQuery] = useState("");
  const [foreignSearchQuery, setForeignSearchQuery] = useState("");
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [expandedContinentId, setExpandedContinentId] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileControlsSticky, setIsMobileControlsSticky] = useState(false);
  const [isMobileControlsOverlayOpen, setIsMobileControlsOverlayOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const globalControlsRef = useRef<HTMLElement | null>(null);
  const lastAutoRefreshKeyRef = useRef<string | null>(null);
  const comparisonPairInitializationRef = useRef<string | null>(null);
  const quickInsightsImpressionRef = useRef<string | null>(null);
  const globalControlsImpressionRef = useRef<string | null>(null);
  const freshnessStatusShownRef = useRef<string | null>(null);
  const previousFreshnessStatusRef = useRef<AppFreshnessStatus | null>(null);
  const sourceWithoutNewCutRef = useRef<string | null>(null);
  const previousMobileStickyRef = useRef(false);
  const foreignContinents = snapshot?.foreign.continents ?? [];

  async function loadAppData(
    options: {
      background?: boolean;
      trigger?: "initial" | "manual" | "auto";
    } = {}
  ) {
    const { background = false, trigger = "initial" } = options;

    if (background) {
      setRefreshing(true);
      setRefreshFeedback(null);
    } else {
      setLoading(true);
    }

    try {
      const previousSnapshot = snapshot;
      const data = background ? await refreshAppData() : await fetchAppData();

      setSnapshot(data.snapshot);
      setHealth(data.health);
      setError(null);
      if (!background || trigger !== "manual") {
        setRefreshFeedback(null);
      }

      if (trigger === "manual") {
        const sourceHasNewCut = getSourceHasNewCut(
          data.snapshot.sourceLastUpdatedAt,
          data.health.lastSuccessAt,
          previousSnapshot?.sourceLastUpdatedAt ?? null
        );

        setRefreshFeedback({
          kind: "success",
          message: "App actualizada correctamente."
        });
        trackEvent("refresh_manual_success", {
          app_fetch_age_minutes: getAppFetchAgeMinutes(data.health.lastSuccessAt, clockNow) ?? undefined,
          app_freshness_status: deriveAppFreshnessStatus(data.health.lastSuccessAt, clockNow),
          source_age_minutes: getSourceAgeMinutes(data.snapshot.sourceLastUpdatedAt, clockNow),
          source_has_new_cut: sourceHasNewCut,
          snapshot_generated_at: data.snapshot.generatedAt
        });
      }
    } catch (reason) {
      const message = (reason as Error).message;

      if (background && snapshot) {
        if (trigger === "manual") {
          setRefreshFeedback({
            kind: "error",
            message: "No se pudo actualizar. Intenta nuevamente."
          });
          trackEvent("refresh_manual_error", {
            app_fetch_age_minutes: getAppFetchAgeMinutes(health?.lastSuccessAt ?? null, clockNow) ?? undefined,
            app_freshness_status: deriveAppFreshnessStatus(health?.lastSuccessAt ?? null, clockNow),
            source_age_minutes: snapshot ? getSourceAgeMinutes(snapshot.sourceLastUpdatedAt, clockNow) : undefined,
            source_has_new_cut: snapshot
              ? getSourceHasNewCut(
                  snapshot.sourceLastUpdatedAt,
                  health?.lastSuccessAt ?? null,
                  snapshot.sourceLastUpdatedAt
                )
              : undefined,
            snapshot_generated_at: snapshot?.generatedAt,
            error_message: message
          });
        }
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

    void loadAppData();
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

      if (!isMobile) {
        setIsMobileControlsOverlayOpen(false);
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
    if (!(isMobileViewport && isMobileControlsOverlayOpen)) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileControlsOverlayOpen, isMobileViewport]);

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

  const appLastSuccessAt = health?.lastSuccessAt ?? null;
  const appFetchAgeMinutes = getAppFetchAgeMinutes(appLastSuccessAt, clockNow);
  const sourceAgeMinutes = snapshot ? getSourceAgeMinutes(snapshot.sourceLastUpdatedAt, clockNow) : null;
  const appFreshnessStatus = deriveAppFreshnessStatus(appLastSuccessAt, clockNow);
  const nextAutoRefreshInMinutes = getNextAutoRefreshInMinutes(appLastSuccessAt, clockNow);
  const sourceHasNewCut = snapshot
    ? getSourceHasNewCut(snapshot.sourceLastUpdatedAt, appLastSuccessAt)
    : true;
  const statusNote = refreshFeedback?.kind === "error"
    ? refreshFeedback.message
    : refreshFeedback?.kind === "success" && appFreshnessStatus === "Al día"
      ? refreshFeedback.message
      : appFreshnessStatus === "Desactualizado"
        ? "Mostramos el último snapshot disponible."
        : !sourceHasNewCut
          ? "ONPE aún no publica un corte más reciente."
          : "La app está al día.";
  const appFreshnessPayload = {
    app_fetch_age_minutes: appFetchAgeMinutes ?? undefined,
    app_freshness_status: appFreshnessStatus,
    source_age_minutes: sourceAgeMinutes ?? undefined,
    source_has_new_cut: sourceHasNewCut,
    snapshot_generated_at: snapshot?.generatedAt ?? undefined
  };

  useEffect(() => {
    if (!snapshot || loading || refreshing || !shouldAutoRefresh(appLastSuccessAt, clockNow)) {
      return;
    }

    const refreshKey = `${appLastSuccessAt ?? "none"}:${snapshot.generatedAt}:${clockNow}`;

    if (lastAutoRefreshKeyRef.current === refreshKey) {
      return;
    }

    lastAutoRefreshKeyRef.current = refreshKey;
    void loadAppData({
      background: true,
      trigger: "auto"
    });
  }, [appLastSuccessAt, clockNow, loading, refreshing, snapshot]);

  const comparisonCandidateOptions = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return buildComparisonCandidateOptions(snapshot);
  }, [snapshot]);
  const comparisonOptionLabels = useMemo(
    () => getPairLabelByCode(comparisonCandidateOptions),
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

  const sortedRegions = useMemo(() => {
    if (!snapshot || !comparisonPair) {
      return [];
    }

    const orderedRegions = sortRegions(snapshot.regions, sortKey, comparisonMode, comparisonPair);
    const normalizedSearch = regionSearchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return orderedRegions;
    }

    return orderedRegions.filter((region) => region.label.toLowerCase().includes(normalizedSearch));
  }, [
    comparisonMode,
    comparisonPair,
    snapshot,
    sortKey,
    regionSearchQuery
  ]);

  const sortedContinents = useMemo(() => {
    if (!snapshot || !comparisonPair) {
      return [];
    }

    const orderedContinents = sortForeignContinents(
      foreignContinents,
      sortKey,
      comparisonMode,
      comparisonPair
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
    comparisonMode,
    comparisonPair,
    foreignContinents,
    foreignSearchQuery,
    snapshot
  ]);

  const featuredComparisonBars = useMemo(() => {
    if (!snapshot || !comparisonPair) {
      return [];
    }

    return buildNationalComparisonPairItems(snapshot, comparisonPair);
  }, [comparisonPair, snapshot]);
  const comparisonItemsByCode = useMemo(
    () => new Map(featuredComparisonBars.map((item) => [item.code, item])),
    [featuredComparisonBars]
  );
  const selectedComparisonLabel = getComparisonColumnLabel(comparisonMode);
  const candidateAItem = comparisonPair
    ? comparisonItemsByCode.get(comparisonPair.candidateACode) ?? null
    : null;
  const candidateBItem = comparisonPair
    ? comparisonItemsByCode.get(comparisonPair.candidateBCode) ?? null
    : null;
  const candidateALabel = comparisonPair
    ? formatTitleCase(comparisonOptionLabels.get(comparisonPair.candidateACode) ?? "Sin dato")
    : "Sin dato";
  const candidateBLabel = comparisonPair
    ? formatTitleCase(comparisonOptionLabels.get(comparisonPair.candidateBCode) ?? "Sin dato")
    : "Sin dato";
  const quickInsightsTrackingBase = {
    candidate_a_code: comparisonPair?.candidateACode ?? undefined,
    candidate_b_code: comparisonPair?.candidateBCode ?? undefined,
    candidate_a_label: candidateALabel !== "Sin dato" ? candidateALabel : undefined,
    candidate_b_label: candidateBLabel !== "Sin dato" ? candidateBLabel : undefined,
    actual_gap_percentage:
      candidateAItem && candidateBItem
        ? Number((candidateAItem.actualPercentage - candidateBItem.actualPercentage).toFixed(3))
        : undefined,
    actual_gap_votes:
      candidateAItem && candidateBItem ? candidateAItem.actualVotes - candidateBItem.actualVotes : undefined,
    projected_gap_percentage:
      candidateAItem && candidateBItem
        ? Number((candidateAItem.projectedPercentage - candidateBItem.projectedPercentage).toFixed(3))
        : undefined,
    projected_gap_votes:
      candidateAItem && candidateBItem
        ? candidateAItem.projectedVotes - candidateBItem.projectedVotes
        : undefined,
    snapshot_generated_at: snapshot?.generatedAt ?? undefined
  };

  useEffect(() => {
    if (!snapshot || !comparisonPair) {
      return;
    }

    const impressionKey = `${snapshot.generatedAt}:${comparisonPair.candidateACode}:${comparisonPair.candidateBCode}`;

    if (quickInsightsImpressionRef.current === impressionKey) {
      return;
    }

    trackEvent("quick_insights_impression", quickInsightsTrackingBase);
    quickInsightsImpressionRef.current = impressionKey;
  }, [comparisonPair, quickInsightsTrackingBase, snapshot]);

  useEffect(() => {
    if (!snapshot || !health) {
      return;
    }

    const impressionKey = `${snapshot.generatedAt}:${appFreshnessStatus}:${sourceHasNewCut}`;

    if (freshnessStatusShownRef.current !== impressionKey) {
      trackEvent("app_freshness_status_shown", appFreshnessPayload);
      freshnessStatusShownRef.current = impressionKey;
    }

    if (
      previousFreshnessStatusRef.current !== null &&
      previousFreshnessStatusRef.current !== appFreshnessStatus
    ) {
      trackEvent("app_freshness_status_changed", {
        ...appFreshnessPayload,
        previous_status: previousFreshnessStatusRef.current
      });
    }

    previousFreshnessStatusRef.current = appFreshnessStatus;
  }, [appFreshnessPayload, appFreshnessStatus, health, snapshot, sourceHasNewCut]);

  useEffect(() => {
    if (!snapshot || sourceHasNewCut) {
      return;
    }

    const contextKey = `${snapshot.generatedAt}:${sourceHasNewCut}`;

    if (sourceWithoutNewCutRef.current === contextKey) {
      return;
    }

    trackEvent("source_without_new_cut_shown", appFreshnessPayload);
    sourceWithoutNewCutRef.current = contextKey;
  }, [appFreshnessPayload, snapshot, sourceHasNewCut]);

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

  function trackGlobalControlChange(
    controlName: "comparison_mode" | "show_others" | "reset",
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
    trackEvent("refresh_manual_click", appFreshnessPayload);
    trackEvent("refresh_snapshot", {
      source: "hero_status",
      ...appFreshnessPayload
    });

    void loadAppData({
      background: true,
      trigger: "manual"
    });
  }

  function handleSortChange(nextSortKey: SortKey) {
    setSortKey(nextSortKey);
    trackEvent("change_region_sort", {
      sort_key: nextSortKey
    });
  }

  function handleComparisonCandidateChange(
    selector: "candidate_a" | "candidate_b",
    nextCode: string
  ) {
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

  function handleGlobalReset() {
    if (!snapshot) {
      return;
    }

    const defaultPairResolution = resolveDefaultComparisonPair(snapshot);
    trackGlobalControlChange("reset", "custom_state", "editorial_defaults");
    trackGlobalControlChange("comparison_mode", comparisonMode, DEFAULT_COMPARISON_MODE);
    trackGlobalControlChange("show_others", showOthers, DEFAULT_SHOW_OTHERS);
    setComparisonPair(defaultPairResolution.pair);
    setComparisonMode(DEFAULT_COMPARISON_MODE);
    setShowOthers(DEFAULT_SHOW_OTHERS);
    setSortKey(DEFAULT_REGION_SORT);
    setComparisonInvalidSelector(null);
    setComparisonValidationMessage(null);
    setComparisonAdjustmentMessage(
      defaultPairResolution.initSource === "fallback"
        ? "Ajustamos la comparación al mejor par disponible."
        : null
    );
  }

  function handleQuickInsightDetailClick() {
    handleComparisonModeChange("projected", "quick_insight_cta");
    trackEvent("quick_insight_detail_cta_click", {
      source: "quick_insights",
      section_target: "comparativa-central",
      target_mode: "comparison_pair"
    });
  }

  function handleMobileControlsToggle() {
    setIsMobileControlsOverlayOpen((currentValue) => !currentValue);
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
    if (!comparisonPair) {
      return {
        votes: "Sin dato",
        percentage: "Sin dato",
        detail: "Comparación no disponible"
      };
    }

    const comparisonGap = getScopeComparisonGap(scope, comparisonPair, comparisonMode);

    return {
      votes: formatSignedNumber(comparisonGap.gapVotes),
      percentage: `${formatSignedDecimal(comparisonGap.gapPercentage, 2)} pp`,
      detail: getComparisonPairDetail(comparisonPair, comparisonOptionLabels, comparisonMode)
    };
  }

  const quickInsightsTitle = comparisonPair
    ? `${candidateALabel} vs ${candidateBLabel}`
    : "Comparación no disponible";
  const currentCandidateAPercentageValue = candidateAItem
    ? formatPercent(candidateAItem.actualPercentage, 2)
    : null;
  const currentCandidateAVotesValue = candidateAItem
    ? `${formatNumber(candidateAItem.actualVotes)} votos`
    : null;
  const currentCandidateBPercentageValue = candidateBItem
    ? formatPercent(candidateBItem.actualPercentage, 2)
    : null;
  const currentCandidateBVotesValue = candidateBItem
    ? `${formatNumber(candidateBItem.actualVotes)} votos`
    : null;
  const currentGapPpValue =
    candidateAItem && candidateBItem
      ? `${formatSignedDecimal(candidateAItem.actualPercentage - candidateBItem.actualPercentage, 2)} pp`
      : null;
  const currentGapVotesValue =
    candidateAItem && candidateBItem
      ? `${formatSignedNumber(candidateAItem.actualVotes - candidateBItem.actualVotes)} votos`
      : null;
  const projectedCandidateAPercentageValue = candidateAItem
    ? formatPercent(candidateAItem.projectedPercentage, 2)
    : null;
  const projectedCandidateAVotesValue = candidateAItem
    ? `${formatNumber(candidateAItem.projectedVotes)} votos`
    : null;
  const projectedCandidateBPercentageValue = candidateBItem
    ? formatPercent(candidateBItem.projectedPercentage, 2)
    : null;
  const projectedCandidateBVotesValue = candidateBItem
    ? `${formatNumber(candidateBItem.projectedVotes)} votos`
    : null;
  const projectedGapPpValue =
    candidateAItem && candidateBItem
      ? `${formatSignedDecimal(candidateAItem.projectedPercentage - candidateBItem.projectedPercentage, 2)} pp`
      : null;
  const projectedGapVotesValue =
    candidateAItem && candidateBItem
      ? `${formatSignedNumber(candidateAItem.projectedVotes - candidateBItem.projectedVotes)} votos`
      : null;
  const actasPeruValue = formatPercent(snapshot?.national.actasContabilizadasPct ?? 0, 2);
  const actasExteriorValue = formatPercent(snapshot?.foreign.actasContabilizadasPct ?? 0, 2);
  const deltaProyeccionValue = formatSignedNumber(
    (snapshot?.projectedNational.totalProjectedValidVotes ?? 0) -
      ((snapshot?.national.totalVotosValidos ?? 0) + (snapshot?.foreign.totalVotosValidos ?? 0))
  );
  const mobileCandidateASummary = comparisonPair
    ? `A: ${formatTitleCase(comparisonOptionLabels.get(comparisonPair.candidateACode) ?? "Sin dato")}`
    : "A: Sin dato";
  const mobileCandidateBSummary = comparisonPair
    ? `B: ${formatTitleCase(comparisonOptionLabels.get(comparisonPair.candidateBCode) ?? "Sin dato")}`
    : "B: Sin dato";
  const mobileComparisonSummary = comparisonMode === "projected" ? "Proyectado" : "Actual ONPE";
  const mobileOthersSummary = showOthers ? "Otros On" : "Otros Off";
  const comparisonNotice = comparisonValidationMessage ?? comparisonAdjustmentMessage;
  const comparisonNoticeClassName = comparisonValidationMessage
    ? "global-controls__notice global-controls__notice--error"
    : "global-controls__notice";
  const showMobileControlsSummary = isMobileViewport;
  const showMobileControlsOverlay = isMobileViewport && isMobileControlsOverlayOpen;
  const showInlineGlobalControlsRow = !isMobileViewport;
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
              onChange={(event) => handleComparisonCandidateChange("candidate_a", event.target.value)}
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
              onChange={(event) => handleComparisonCandidateChange("candidate_b", event.target.value)}
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
  );

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
            <span>Última actualización de esta app</span>
            <strong>
              {appLastSuccessAt
                ? `${formatRelativeMinutes(appLastSuccessAt, clockNow)} (${formatTime(appLastSuccessAt)})`
                : "Sin actualización exitosa reciente"}
            </strong>
          </div>
          <div>
            <span>Próxima revisión automática</span>
            <strong>
              {nextAutoRefreshInMinutes === null
                ? "Pendiente"
                : nextAutoRefreshInMinutes === 0
                  ? "En curso"
                  : `en ${nextAutoRefreshInMinutes} min`}
            </strong>
          </div>
          <div>
            <span>Última publicación ONPE</span>
            <strong>
              {`${formatRelativeMinutes(snapshot.sourceLastUpdatedAt, clockNow)} (${formatTime(
                snapshot.sourceLastUpdatedAt
              )})`}
            </strong>
          </div>
          <div id="estado-actualizacion">
            <div className="status-card__top">
              <div>
                <span>Estado de actualización</span>
                <strong
                  className={
                    appFreshnessStatus === "Desactualizado"
                      ? "status-badge is-stale"
                      : "status-badge"
                  }
                >
                  {appFreshnessStatus}
                </strong>
              </div>
              <button
                className={`refresh-button ${refreshing ? "is-loading" : ""}`}
                type="button"
                onClick={handleRefreshClick}
                disabled={refreshing}
              >
                {refreshing ? <span className="refresh-button__spinner" aria-hidden="true" /> : null}
                {refreshing ? "Actualizando datos..." : "Actualizar ahora"}
              </button>
            </div>
            <small className="status-card__note">
              {statusNote}
            </small>
            <small className="status-card__meta">
              Snapshot visible: {formatDateTime(snapshot.generatedAt)}
            </small>
          </div>
        </div>
      </section>

      <section
        ref={globalControlsRef}
        className={`global-controls ${isMobileControlsSticky ? "is-mobile-sticky" : ""} ${showMobileControlsOverlay ? "is-overlay-open" : ""}`}
        aria-label="Controles globales"
      >
        {showMobileControlsSummary ? (
          <div className="global-controls__mobile-summary">
            <div className="global-controls__mobile-summary-text">
              <span>{mobileCandidateASummary}</span>
              <span>{mobileCandidateBSummary}</span>
              <span>{mobileComparisonSummary}</span>
              <span>{mobileOthersSummary}</span>
            </div>
            <button
              className="global-controls__mobile-toggle"
              type="button"
              aria-expanded={isMobileControlsOverlayOpen}
              aria-label={isMobileControlsOverlayOpen ? "Ocultar filtros" : "Abrir filtros"}
              onClick={handleMobileControlsToggle}
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
          <a
            className="quick-insights__cta"
            href="#comparativa-central"
            onClick={handleQuickInsightDetailClick}
          >
            Ver comparativa personalizada
          </a>
        </div>

        <div className="quick-insights__matrix" aria-label="Comparativa rápida actual y proyectada de los candidatos seleccionados">
          <div className="quick-insights__matrix-head" aria-hidden="true">
            <span />
            <p>{candidateALabel}</p>
            <p>{candidateBLabel}</p>
            <p>Brecha A vs B</p>
          </div>

          <div className="quick-insights__matrix-row">
            <p className="quick-insights__row-label">Actual ONPE</p>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">{candidateALabel}</p>
              <strong>{currentCandidateAPercentageValue ?? "Insight no disponible"}</strong>
              <small>{currentCandidateAVotesValue ?? "Sin dato"}</small>
            </article>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">{candidateBLabel}</p>
              <strong>{currentCandidateBPercentageValue ?? "Insight no disponible"}</strong>
              <small>{currentCandidateBVotesValue ?? "Sin dato"}</small>
            </article>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">Brecha A vs B</p>
              <strong>{currentGapPpValue ?? "Insight no disponible"}</strong>
              <small>{currentGapVotesValue ?? "Sin dato"}</small>
            </article>
          </div>

          <div className="quick-insights__matrix-row">
            <p className="quick-insights__row-label">Proyección total</p>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">{candidateALabel}</p>
              <strong>{projectedCandidateAPercentageValue ?? "Insight no disponible"}</strong>
              <small>{projectedCandidateAVotesValue ?? "Sin dato"}</small>
            </article>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">{candidateBLabel}</p>
              <strong>{projectedCandidateBPercentageValue ?? "Insight no disponible"}</strong>
              <small>{projectedCandidateBVotesValue ?? "Sin dato"}</small>
            </article>
            <article className="quick-insight-kpi">
              <p className="quick-insight-kpi__mobile-label">Brecha A vs B</p>
              <strong>{projectedGapPpValue ?? "Insight no disponible"}</strong>
              <small>{projectedGapVotesValue ?? "Sin dato"}</small>
            </article>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <section className="panel" id="comparativa-central">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Comparativa central</p>
              <h2>Candidatos seleccionados, total elección</h2>
            </div>
          </div>

          <div className="featured-bars">
            {featuredComparisonBars.map((item) => (
              <FeaturedBar
                key={item.code}
                item={item}
              />
            ))}
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
                              showOthers={showOthers}
                              comparisonMode={comparisonMode}
                              comparisonPair={comparisonPair!}
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
                              showOthers={showOthers}
                              comparisonMode={comparisonMode}
                              comparisonPair={comparisonPair!}
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
