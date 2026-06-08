import { useEffect, useMemo, useRef, useState } from "react";

import {
  GlobalControls,
  useComparisonControls,
  useMobileGlobalControls
} from "./components/global-controls";
import {
  ErrorScreen,
  FeaturedComparisonSection,
  ForeignResultsTable,
  HeroSection,
  LoadingScreen,
  MethodologySection,
  QuickInsightsSection,
  RegionalResultsTable,
  SecondRoundSummarySection
} from "./components/sections";
import {
  initializeAnalytics,
  trackEvent,
  trackInitialPageView
} from "./lib/analytics";
import { useElectionData } from "./hooks/useElectionData";
import { useFreshnessStatus } from "./hooks/useFreshnessStatus";
import {
  buildNationalComparisonPairItems,
  getScopeComparisonGap,
  type ComparisonMode
} from "./lib/comparison";
import { getComparisonColumnLabel, getComparisonPairDetail } from "./lib/comparisonDisplay";
import {
  formatNumber,
  formatPercent,
  formatSignedDecimal,
  formatSignedNumber,
  formatTitleCase
} from "./lib/format";
import {
  sortForeignContinents,
  sortRegions,
  type SortKey
} from "./lib/scopeSorting";
import {
  shouldAutoRefresh,
  type AppFreshnessStatus
} from "./lib/trust";
import type {
  ComparableScope,
  ElectionRound
} from "./lib/types";

const DEFAULT_REGION_SORT: SortKey = "gap_2v3";

function RoundView({
  round,
  active,
  clockNow
}: {
  round: ElectionRound;
  active: boolean;
  clockNow: number;
}) {
  const [hasStarted, setHasStarted] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_REGION_SORT);
  const [regionSearchQuery, setRegionSearchQuery] = useState("");
  const [foreignSearchQuery, setForeignSearchQuery] = useState("");
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [expandedContinentId, setExpandedContinentId] = useState<string | null>(null);
  const {
    data: { snapshot, health, error, loading, refreshing, refreshFeedback },
    actions: { loadInitial, refreshManual, maybeRefreshAuto }
  } = useElectionData({ clockNow, round });
  const {
    appLastSuccessAt,
    appFreshnessStatus,
    nextAutoRefreshInMinutes,
    sourceHasNewCut,
    statusNote,
    trackingPayload: appFreshnessPayload
  } = useFreshnessStatus({
    snapshot,
    health,
    refreshFeedback,
    clockNow
  });
  const globalControlsRef = useRef<HTMLElement | null>(null);
  const quickInsightsImpressionRef = useRef<string | null>(null);
  const freshnessStatusShownRef = useRef<string | null>(null);
  const previousFreshnessStatusRef = useRef<AppFreshnessStatus | null>(null);
  const sourceWithoutNewCutRef = useRef<string | null>(null);
  const foreignContinents = snapshot?.foreign.continents ?? [];
  const {
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
  } = useComparisonControls(snapshot, {
    onResetSort: () => setSortKey(DEFAULT_REGION_SORT)
  });
  const {
    isMobileControlsSticky,
    isMobileControlsOverlayOpen,
    showMobileControlsSummary,
    showMobileControlsOverlay,
    showInlineGlobalControlsRow,
    handleMobileControlsToggle
  } = useMobileGlobalControls(globalControlsRef);

  useEffect(() => {
    if (!active || hasStarted) {
      return;
    }

    setHasStarted(true);
    void loadInitial();
  }, [active, hasStarted, loadInitial]);

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

  useEffect(() => {
    if (!active || !snapshot || loading || refreshing || !shouldAutoRefresh(appLastSuccessAt, clockNow)) {
      return;
    }

    const refreshKey = `${appLastSuccessAt ?? "none"}:${snapshot.generatedAt}`;
    void maybeRefreshAuto({
      appLastSuccessAt,
      shouldRefresh: true,
      refreshKey,
      now: clockNow
    });
  }, [active, appLastSuccessAt, clockNow, loading, maybeRefreshAuto, refreshing, snapshot]);

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
  }, [comparisonMode, comparisonPair, regionSearchQuery, snapshot, sortKey]);

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
      const matchingCountries = continent.countries.filter((country) =>
        country.label.toLowerCase().includes(normalizedSearch)
      );

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
  }, [comparisonMode, comparisonPair, foreignContinents, foreignSearchQuery, snapshot, sortKey]);

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
    snapshot_generated_at: snapshot?.generatedAt ?? undefined,
    round
  };

  useEffect(() => {
    if (!active || !snapshot || !comparisonPair || round !== "first") {
      return;
    }

    const impressionKey = `${snapshot.generatedAt}:${comparisonPair.candidateACode}:${comparisonPair.candidateBCode}`;

    if (quickInsightsImpressionRef.current === impressionKey) {
      return;
    }

    trackEvent("quick_insights_impression", quickInsightsTrackingBase);
    quickInsightsImpressionRef.current = impressionKey;
  }, [active, comparisonPair, quickInsightsTrackingBase, round, snapshot]);

  useEffect(() => {
    if (!active || !snapshot || !health) {
      return;
    }

    const impressionKey = `${snapshot.generatedAt}:${appFreshnessStatus}:${sourceHasNewCut}:${round}`;

    if (freshnessStatusShownRef.current !== impressionKey) {
      trackEvent("app_freshness_status_shown", { ...appFreshnessPayload, round });
      freshnessStatusShownRef.current = impressionKey;
    }

    if (
      previousFreshnessStatusRef.current !== null &&
      previousFreshnessStatusRef.current !== appFreshnessStatus
    ) {
      trackEvent("app_freshness_status_changed", {
        ...appFreshnessPayload,
        previous_status: previousFreshnessStatusRef.current,
        round
      });
    }

    previousFreshnessStatusRef.current = appFreshnessStatus;
  }, [active, appFreshnessPayload, appFreshnessStatus, health, round, snapshot, sourceHasNewCut]);

  useEffect(() => {
    if (!active || !snapshot || sourceHasNewCut) {
      return;
    }

    const contextKey = `${snapshot.generatedAt}:${sourceHasNewCut}:${round}`;

    if (sourceWithoutNewCutRef.current === contextKey) {
      return;
    }

    trackEvent("source_without_new_cut_shown", { ...appFreshnessPayload, round });
    sourceWithoutNewCutRef.current = contextKey;
  }, [active, appFreshnessPayload, round, snapshot, sourceHasNewCut]);

  function handleRefreshClick() {
    trackEvent("refresh_manual_click", { ...appFreshnessPayload, round });
    trackEvent("refresh_snapshot", {
      source: "hero_status",
      ...appFreshnessPayload,
      round
    });

    void refreshManual();
  }

  function handleSortChange(nextSortKey: SortKey) {
    setSortKey(nextSortKey);
    trackEvent("change_region_sort", {
      sort_key: nextSortKey,
      round
    });
  }

  function handleQuickInsightDetailClick() {
    handleComparisonModeChange("projected", "quick_insight_cta");
    trackEvent("quick_insight_detail_cta_click", {
      source: "quick_insights",
      section_target: "comparativa-central",
      target_mode: "comparison_pair",
      round
    });
  }

  function handleRegionToggle(regionId: string) {
    setExpandedRegionId((currentRegionId) => {
      const nextRegionId = currentRegionId === regionId ? null : regionId;

      trackEvent("toggle_region_province_drilldown", {
        region_id: regionId,
        expanded: nextRegionId === regionId,
        round
      });

      return nextRegionId;
    });
  }

  function handleContinentToggle(continentId: string) {
    setExpandedContinentId((currentContinentId) => {
      const nextContinentId = currentContinentId === continentId ? null : continentId;

      trackEvent("toggle_foreign_country_drilldown", {
        continent_id: continentId,
        expanded: nextContinentId === continentId,
        round
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

  if (!hasStarted) {
    return null;
  }

  if (loading) {
    return active ? <LoadingScreen /> : null;
  }

  if (error || !snapshot) {
    return active ? <ErrorScreen error={error} /> : null;
  }

  const heroCopy =
    round === "second"
      ? {
        eyebrow: "Resultados presidenciales 2026 · Segunda vuelta",
        title: "Conteo oficial ONPE entre los dos finalistas",
        lede: "Sigue el resultado actual del balotaje, compara a los finalistas y revisa el avance por región y exterior.",
        primaryCtaLabel: "Explorar regiones",
        secondaryCtaLabel: "Ver metodología",
        microcopy: "Esta vista usa el host independiente de ONPE para segunda vuelta."
      }
      : undefined;

  const quickInsightsTitle = comparisonPair
    ? `${candidateALabel} vs ${candidateBLabel}`
    : "Comparación no disponible";

  return (
    <div hidden={!active}>
      <HeroSection
        appLastSuccessAt={appLastSuccessAt}
        clockNow={clockNow}
        nextAutoRefreshInMinutes={nextAutoRefreshInMinutes}
        sourceLastUpdatedAt={snapshot.sourceLastUpdatedAt}
        appFreshnessStatus={appFreshnessStatus}
        refreshing={refreshing}
        statusNote={statusNote}
        snapshotGeneratedAt={snapshot.generatedAt}
        onRefreshClick={handleRefreshClick}
        onPrimaryCtaClick={handleHeroPrimaryCtaClick}
        onSecondaryCtaClick={handleHeroSecondaryCtaClick}
        {...heroCopy}
      />

      <GlobalControls
        ref={globalControlsRef}
        isMobileControlsSticky={isMobileControlsSticky}
        showMobileControlsSummary={showMobileControlsSummary}
        showInlineGlobalControlsRow={showInlineGlobalControlsRow}
        showMobileControlsOverlay={showMobileControlsOverlay}
        isMobileControlsOverlayOpen={isMobileControlsOverlayOpen}
        mobileSummary={mobileSummary}
        onMobileControlsToggle={handleMobileControlsToggle}
        comparisonCandidateOptions={comparisonCandidateOptions}
        comparisonPair={comparisonPair}
        comparisonInvalidSelector={comparisonInvalidSelector}
        comparisonNotice={comparisonNotice}
        comparisonNoticeClassName={comparisonNoticeClassName}
        onComparisonCandidateChange={handleComparisonCandidateChange}
        comparisonMode={comparisonMode}
        onComparisonModeChange={(nextMode) => handleComparisonModeChange(nextMode)}
        showOthers={showOthers}
        onShowOthersToggle={handleShowOthersToggle}
        onGlobalReset={handleGlobalReset}
      />

      {round === "first" ? (
        <QuickInsightsSection
          quickInsightsTitle={quickInsightsTitle}
          actasPeruValue={formatPercent(snapshot.national.actasContabilizadasPct, 2)}
          actasExteriorValue={formatPercent(snapshot.foreign.actasContabilizadasPct, 2)}
          deltaProyeccionValue={formatSignedNumber(
            snapshot.projectedNational.totalProjectedValidVotes -
              (snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos)
          )}
          candidateA={{
            label: candidateALabel,
            code: comparisonPair?.candidateACode ?? "otros",
            deltaValue: candidateAItem ? `${formatSignedDecimal(candidateAItem.deltaPercentage, 2)} pp` : null,
            item: candidateAItem
          }}
          candidateB={{
            label: candidateBLabel,
            code: comparisonPair?.candidateBCode ?? "otros",
            deltaValue: candidateBItem ? `${formatSignedDecimal(candidateBItem.deltaPercentage, 2)} pp` : null,
            item: candidateBItem
          }}
          current={{
            candidateAPercentageValue: candidateAItem ? formatPercent(candidateAItem.actualPercentage, 2) : null,
            candidateAVotesValue: candidateAItem ? `${formatNumber(candidateAItem.actualVotes)} votos` : null,
            candidateBPercentageValue: candidateBItem ? formatPercent(candidateBItem.actualPercentage, 2) : null,
            candidateBVotesValue: candidateBItem ? `${formatNumber(candidateBItem.actualVotes)} votos` : null,
            gapPpValue:
              candidateAItem && candidateBItem
                ? `${formatSignedDecimal(candidateAItem.actualPercentage - candidateBItem.actualPercentage, 2)} pp`
                : null,
            gapVotesValue:
              candidateAItem && candidateBItem
                ? `${formatSignedNumber(candidateAItem.actualVotes - candidateBItem.actualVotes)} votos`
                : null,
            gapRaw:
              candidateAItem && candidateBItem
                ? candidateAItem.actualPercentage - candidateBItem.actualPercentage
                : null
          }}
          projected={{
            candidateAPercentageValue: candidateAItem ? formatPercent(candidateAItem.projectedPercentage, 2) : null,
            candidateAVotesValue: candidateAItem ? `${formatNumber(candidateAItem.projectedVotes)} votos` : null,
            candidateBPercentageValue: candidateBItem ? formatPercent(candidateBItem.projectedPercentage, 2) : null,
            candidateBVotesValue: candidateBItem ? `${formatNumber(candidateBItem.projectedVotes)} votos` : null,
            gapPpValue:
              candidateAItem && candidateBItem
                ? `${formatSignedDecimal(candidateAItem.projectedPercentage - candidateBItem.projectedPercentage, 2)} pp`
                : null,
            gapVotesValue:
              candidateAItem && candidateBItem
                ? `${formatSignedNumber(candidateAItem.projectedVotes - candidateBItem.projectedVotes)} votos`
                : null,
            gapRaw:
              candidateAItem && candidateBItem
                ? candidateAItem.projectedPercentage - candidateBItem.projectedPercentage
                : null
          }}
          onDetailClick={handleQuickInsightDetailClick}
        />
      ) : (
        <SecondRoundSummarySection
          candidateA={candidateAItem}
          candidateB={candidateBItem}
          sourceLastUpdatedAt={snapshot.sourceLastUpdatedAt}
          actasPeruPct={snapshot.national.actasContabilizadasPct}
          actasExteriorPct={snapshot.foreign.actasContabilizadasPct}
        />
      )}

      <section className="content-grid">
        <FeaturedComparisonSection items={featuredComparisonBars} />
        <RegionalResultsTable
          regions={sortedRegions}
          sortKey={sortKey}
          regionSearchQuery={regionSearchQuery}
          showOthers={showOthers}
          selectedComparisonLabel={selectedComparisonLabel}
          comparisonMode={comparisonMode}
          comparisonPair={comparisonPair}
          comparisonOptionLabels={comparisonOptionLabels}
          expandedRegionId={expandedRegionId}
          onSortChange={handleSortChange}
          onSearchChange={setRegionSearchQuery}
          onRegionToggle={handleRegionToggle}
          getScopeComparisonDisplay={getScopeComparisonDisplay}
        />
        <ForeignResultsTable
          continents={sortedContinents}
          foreignSearchQuery={foreignSearchQuery}
          showOthers={showOthers}
          selectedComparisonLabel={selectedComparisonLabel}
          comparisonMode={comparisonMode}
          comparisonPair={comparisonPair}
          comparisonOptionLabels={comparisonOptionLabels}
          expandedContinentId={expandedContinentId}
          onSearchChange={setForeignSearchQuery}
          onContinentToggle={handleContinentToggle}
          getScopeComparisonDisplay={getScopeComparisonDisplay}
          sortKey={sortKey}
        />
        <MethodologySection />
      </section>
    </div>
  );
}

export default function App() {
  const [activeRound, setActiveRound] = useState<ElectionRound>("second");
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    initializeAnalytics();
    trackInitialPageView();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main className="page-shell">
      <nav className="round-tabs" aria-label="Seleccionar vuelta electoral">
        <button
          type="button"
          className={`round-tabs__tab ${activeRound === "first" ? "is-active" : ""}`}
          aria-pressed={activeRound === "first"}
          onClick={() => setActiveRound("first")}
        >
          Primera vuelta
        </button>
        <button
          type="button"
          className={`round-tabs__tab ${activeRound === "second" ? "is-active" : ""}`}
          aria-pressed={activeRound === "second"}
          onClick={() => setActiveRound("second")}
        >
          Segunda vuelta
        </button>
      </nav>

      <RoundView round="first" active={activeRound === "first"} clockNow={clockNow} />
      <RoundView round="second" active={activeRound === "second"} clockNow={clockNow} />
    </main>
  );
}
