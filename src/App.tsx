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
  RegionalResultsTable
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
  type ComparisonItem,
  type ComparisonMode,
  type ComparisonPair
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
  ForeignContinentResult,
  ForeignCountryResult,
  ProvinceResult,
  RegionResult,
  ScopeResult
} from "./lib/types";

type ComparableScope = ScopeResult | ProvinceResult | ForeignCountryResult;

const DEFAULT_REGION_SORT: SortKey = "gap_2v3";

export default function App() {
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_REGION_SORT);
  const [regionSearchQuery, setRegionSearchQuery] = useState("");
  const [foreignSearchQuery, setForeignSearchQuery] = useState("");
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [expandedContinentId, setExpandedContinentId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const {
    data: { snapshot, health, error, loading, refreshing, refreshFeedback },
    actions: { loadInitial, refreshManual, maybeRefreshAuto }
  } = useElectionData({ clockNow });
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
    initializeAnalytics();
    trackInitialPageView();

    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

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
    if (!snapshot || loading || refreshing || !shouldAutoRefresh(appLastSuccessAt, clockNow)) {
      return;
    }

    const refreshKey = `${appLastSuccessAt ?? "none"}:${snapshot.generatedAt}`;
    void maybeRefreshAuto({
      appLastSuccessAt,
      shouldRefresh: true,
      refreshKey,
      now: clockNow
    });
  }, [appLastSuccessAt, clockNow, loading, maybeRefreshAuto, refreshing, snapshot]);

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
    sortKey,
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

  function handleRefreshClick() {
    trackEvent("refresh_manual_click", appFreshnessPayload);
    trackEvent("refresh_snapshot", {
      source: "hero_status",
      ...appFreshnessPayload
    });

    void refreshManual();
  }

  function handleSortChange(nextSortKey: SortKey) {
    setSortKey(nextSortKey);
    trackEvent("change_region_sort", {
      sort_key: nextSortKey
    });
  }

  function handleQuickInsightDetailClick() {
    handleComparisonModeChange("projected", "quick_insight_cta");
    trackEvent("quick_insight_detail_cta_click", {
      source: "quick_insights",
      section_target: "comparativa-central",
      target_mode: "comparison_pair"
    });
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
  const candidateADeltaPpValue =
    candidateAItem
      ? `${formatSignedDecimal(candidateAItem.deltaPercentage, 2)} pp`
      : null;
  const candidateBDeltaPpValue =
    candidateBItem
      ? `${formatSignedDecimal(candidateBItem.deltaPercentage, 2)} pp`
      : null;
  const actasPeruValue = formatPercent(snapshot?.national.actasContabilizadasPct ?? 0, 2);
  const actasExteriorValue = formatPercent(snapshot?.foreign.actasContabilizadasPct ?? 0, 2);
  const deltaProyeccionValue = formatSignedNumber(
    (snapshot?.projectedNational.totalProjectedValidVotes ?? 0) -
      ((snapshot?.national.totalVotosValidos ?? 0) + (snapshot?.foreign.totalVotosValidos ?? 0))
  );
  if (loading) {
    return <LoadingScreen />;
  }

  if (error || !snapshot) {
    return <ErrorScreen error={error} />;
  }

  return (
    <main className="page-shell">
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

      <QuickInsightsSection
        quickInsightsTitle={quickInsightsTitle}
        actasPeruValue={actasPeruValue}
        actasExteriorValue={actasExteriorValue}
        deltaProyeccionValue={deltaProyeccionValue}
        candidateA={{
          label: candidateALabel,
          code: comparisonPair?.candidateACode ?? "otros",
          deltaValue: candidateADeltaPpValue,
          item: candidateAItem
        }}
        candidateB={{
          label: candidateBLabel,
          code: comparisonPair?.candidateBCode ?? "otros",
          deltaValue: candidateBDeltaPpValue,
          item: candidateBItem
        }}
        current={{
          candidateAPercentageValue: currentCandidateAPercentageValue,
          candidateAVotesValue: currentCandidateAVotesValue,
          candidateBPercentageValue: currentCandidateBPercentageValue,
          candidateBVotesValue: currentCandidateBVotesValue,
          gapPpValue: currentGapPpValue,
          gapVotesValue: currentGapVotesValue,
          gapRaw:
            candidateAItem && candidateBItem
              ? candidateAItem.actualPercentage - candidateBItem.actualPercentage
              : null
        }}
        projected={{
          candidateAPercentageValue: projectedCandidateAPercentageValue,
          candidateAVotesValue: projectedCandidateAVotesValue,
          candidateBPercentageValue: projectedCandidateBPercentageValue,
          candidateBVotesValue: projectedCandidateBVotesValue,
          gapPpValue: projectedGapPpValue,
          gapVotesValue: projectedGapVotesValue,
          gapRaw:
            candidateAItem && candidateBItem
              ? candidateAItem.projectedPercentage - candidateBItem.projectedPercentage
              : null
        }}
        onDetailClick={handleQuickInsightDetailClick}
      />

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
    </main>
  );
}
