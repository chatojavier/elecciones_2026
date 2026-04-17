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
type LeafScopeResult = ProvinceResult | ForeignCountryResult;

function CandidatePill({
  code,
  label,
  active,
  onClick
}: {
  code: string;
  label: string;
  active: boolean;
  onClick: (code: string) => void;
}) {
  return (
    <button
      className={`candidate-pill ${active ? "is-active" : ""}`}
      onClick={() => onClick(code)}
      style={{ ["--candidate-color" as string]: getCandidateColor(code) }}
      type="button"
    >
      <span className="candidate-pill__dot" />
      {formatTitleCase(label)}
    </button>
  );
}

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
  const nationalCandidates =
    snapshot.national.candidates.length > 0
      ? snapshot.national.candidates
      : snapshot.national.featuredCandidates;
  const foreignCandidates =
    snapshot.foreign.candidates.length > 0
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
      percentage:
        totalCurrentValidVotes > 0
          ? Number(((entry.votes / totalCurrentValidVotes) * 100).toFixed(3))
          : 0
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
  const gapPp2v3 =
    rank2 && rank3 ? Number((rank2.percentage - rank3.percentage).toFixed(3)) : null;

  return {
    rank2,
    rank3,
    gapVotes2v3,
    gapPp2v3,
    statusLevel: resolveSecondRoundStatusLevel(gapPp2v3)
  };
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
  secondRoundCodes: { rank2Code: string; rank3Code: string } | null
) {
  const sorted = [...regions];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "electores":
        return right.electores - left.electores;
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "candidate": {
        const leftCandidate = left.featuredCandidates.find((candidate) => candidate.code === selectedCode);
        const rightCandidate = right.featuredCandidates.find((candidate) => candidate.code === selectedCode);
        return (rightCandidate?.pctValid ?? 0) - (leftCandidate?.pctValid ?? 0);
      }
      case "gap_2v3": {
        if (!secondRoundCodes) {
          return (right.projectedVotes[selectedCode] ?? 0) - (left.projectedVotes[selectedCode] ?? 0);
        }

        const leftGap = getScopeSecondRoundGapVotes(
          left,
          secondRoundCodes.rank2Code,
          secondRoundCodes.rank3Code
        );
        const rightGap = getScopeSecondRoundGapVotes(
          right,
          secondRoundCodes.rank2Code,
          secondRoundCodes.rank3Code
        );

        if (leftGap === rightGap) {
          return right.electores - left.electores;
        }

        return leftGap - rightGap;
      }
      case "projection":
        return (right.projectedVotes[selectedCode] ?? 0) - (left.projectedVotes[selectedCode] ?? 0);
      default:
        return 0;
    }
  });

  return sorted;
}

function sortLeafScopes(
  scopes: LeafScopeResult[],
  selectedCode: string,
  comparisonMode: ComparisonMode
) {
  const sorted = [...scopes];

  sorted.sort((left, right) => {
    const leftComparison = buildScopeComparisonItem(left, selectedCode);
    const rightComparison = buildScopeComparisonItem(right, selectedCode);

    if (comparisonMode === "projected") {
      return rightComparison.projectedVotes - leftComparison.projectedVotes;
    }

    return rightComparison.actualVotes - leftComparison.actualVotes;
  });

  return sorted;
}

function sortForeignContinents(
  continents: ForeignContinentResult[],
  selectedCode: string,
  comparisonMode: ComparisonMode
) {
  const sorted = [...continents];

  sorted.sort((left, right) => {
    const leftComparison = buildScopeComparisonItem(left, selectedCode);
    const rightComparison = buildScopeComparisonItem(right, selectedCode);

    if (comparisonMode === "projected") {
      return rightComparison.projectedVotes - leftComparison.projectedVotes;
    }

    return rightComparison.actualVotes - leftComparison.actualVotes;
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
  selectedCode,
  showOthers,
  comparisonMode
}: {
  titleEyebrow: string;
  scopeLabel: string;
  itemSingularLabel: string;
  itemPluralLabel: string;
  recompositionLabel: string;
  scopes: LeafScopeResult[];
  selectedCode: string;
  showOthers: boolean;
  comparisonMode: ComparisonMode;
}) {
  const comparisonLabel =
    comparisonMode === "projected" ? "Proyección seleccionada" : "Actual seleccionado";
  const sortedScopes = sortLeafScopes(scopes, selectedCode, comparisonMode);

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
          const comparisonVotes =
            comparisonMode === "projected"
              ? selectedComparison.projectedVotes
              : selectedComparison.actualVotes;
          const comparisonPercentage =
            comparisonMode === "projected"
              ? selectedComparison.projectedPercentage
              : selectedComparison.actualPercentage;

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
                  <strong>{formatNumber(comparisonVotes)}</strong>
                  <span>{formatPercent(comparisonPercentage, 2)}</span>
                  <small>
                    {formatTitleCase(selectedComparison.label)} ·{" "}
                    {comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"}
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
  const [sortKey, setSortKey] = useState<SortKey>("projection");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [showOthers, setShowOthers] = useState(true);
  const [regionalComparisonMode, setRegionalComparisonMode] =
    useState<ComparisonMode>("projected");
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  const [expandedContinentId, setExpandedContinentId] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const lastAutoRefreshKeyRef = useRef<string | null>(null);
  const quickInsightsImpressionRef = useRef<string | null>(null);
  const quickInsightsStatusRef = useRef<string | null>(null);
  const quickInsightsContextRef = useRef<string | null>(null);
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
    if (!snapshot) {
      return;
    }

    setSelectedCode((currentCode) => {
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

    return sortRegions(snapshot.regions, selectedCode, sortKey, secondRoundCodes);
  }, [secondRoundCodes, selectedCode, snapshot, sortKey]);

  const sortedContinents = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return sortForeignContinents(foreignContinents, selectedCode, regionalComparisonMode);
  }, [foreignContinents, regionalComparisonMode, selectedCode, snapshot]);

  const nationalComparisonItems = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return buildNationalComparisonItems(snapshot);
  }, [snapshot]);

  const featuredComparisonBars = useMemo(
    () => nationalComparisonItems.filter((item) => item.code !== "otros"),
    [nationalComparisonItems]
  );

  const othersBar = snapshot
    ? nationalComparisonItems.find((item) => item.code === "otros") ?? null
    : null;
  const selectedComparisonLabel =
    regionalComparisonMode === "projected" ? "Proyección seleccionada" : "Actual seleccionado";
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

  function handleShowOthersToggle() {
    setShowOthers((currentValue) => {
      const nextValue = !currentValue;

      trackEvent("toggle_others_series", {
        visible: nextValue
      });

      return nextValue;
    });
  }

  function handleRegionalModeChange(nextMode: ComparisonMode) {
    setRegionalComparisonMode(nextMode);
    trackEvent("change_regional_comparison_mode", {
      mode: nextMode
    });
  }

  function handleCandidateSelect(code: string) {
    setSelectedCode(code);
    trackEvent("select_candidate_focus", {
      candidate_code: code
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

      <section className="content-grid">
        <section className="panel" id="comparativa-central">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Comparativa central</p>
              <h2>Candidatos destacados + Otros, total elección</h2>
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
                  <option value="projection">Proyección</option>
                  <option value="candidate">Candidato</option>
                  <option value="electores">Electores</option>
                  <option value="actas">Actas</option>
                  <option value="participacion">Participación</option>
                </select>
              </label>

              <button
                className={`toggle-button ${showOthers ? "is-active" : ""}`}
                type="button"
                onClick={handleShowOthersToggle}
              >
                {showOthers ? "Ocultar Otros" : "Mostrar Otros"}
              </button>

              <div className="control">
                <span>Columna final</span>
                <div className="toggle-group" role="tablist" aria-label="Comparación regional">
                  <button
                    className={`toggle-button ${regionalComparisonMode === "projected" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("projected")}
                  >
                    Proyectado
                  </button>
                  <button
                    className={`toggle-button ${regionalComparisonMode === "current" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("current")}
                  >
                    Actual ONPE
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="candidate-pill-row">
            {featuredLegend.map((candidate) => (
              <CandidatePill
                key={candidate.code}
                code={candidate.code}
                label={candidate.label}
                active={candidate.code === selectedCode}
                onClick={handleCandidateSelect}
              />
            ))}
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
                  const selectedComparison = buildScopeComparisonItem(region, selectedCode);
                  const isExpanded = expandedRegionId === region.scopeId;
                  const isProjectedMode = regionalComparisonMode === "projected";
                  const comparisonVotes = isProjectedMode
                    ? selectedComparison.projectedVotes
                    : selectedComparison.actualVotes;
                  const comparisonPercentage = isProjectedMode
                    ? selectedComparison.projectedPercentage
                    : selectedComparison.actualPercentage;

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
                            <strong>{formatNumber(comparisonVotes)}</strong>
                            <span>{formatPercent(comparisonPercentage, 2)}</span>
                            <small>
                              {formatTitleCase(selectedComparison.label)} ·{" "}
                              {isProjectedMode ? "Proyectado" : "Actual ONPE"}
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
                              selectedCode={selectedCode}
                              showOthers={showOthers}
                              comparisonMode={regionalComparisonMode}
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

        <section className="panel">
          <div className="panel__header panel__header--stack">
            <div>
              <p className="eyebrow">Lectura exterior</p>
              <h2>Tabla de continentes y países</h2>
            </div>

            <div className="controls">
              <button
                className={`toggle-button ${showOthers ? "is-active" : ""}`}
                type="button"
                onClick={handleShowOthersToggle}
              >
                {showOthers ? "Ocultar Otros" : "Mostrar Otros"}
              </button>

              <div className="control">
                <span>Columna final</span>
                <div className="toggle-group" role="tablist" aria-label="Comparación extranjero">
                  <button
                    className={`toggle-button ${regionalComparisonMode === "projected" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("projected")}
                  >
                    Proyectado
                  </button>
                  <button
                    className={`toggle-button ${regionalComparisonMode === "current" ? "is-active" : ""
                      }`}
                    type="button"
                    onClick={() => handleRegionalModeChange("current")}
                  >
                    Actual ONPE
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="candidate-pill-row">
            {featuredLegend.map((candidate) => (
              <CandidatePill
                key={`foreign-${candidate.code}`}
                code={candidate.code}
                label={candidate.label}
                active={candidate.code === selectedCode}
                onClick={handleCandidateSelect}
              />
            ))}
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
                  const selectedComparison = buildScopeComparisonItem(continent, selectedCode);
                  const isExpanded = expandedContinentId === continent.scopeId;
                  const isProjectedMode = regionalComparisonMode === "projected";
                  const comparisonVotes = isProjectedMode
                    ? selectedComparison.projectedVotes
                    : selectedComparison.actualVotes;
                  const comparisonPercentage = isProjectedMode
                    ? selectedComparison.projectedPercentage
                    : selectedComparison.actualPercentage;

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
                            <strong>{formatNumber(comparisonVotes)}</strong>
                            <span>{formatPercent(comparisonPercentage, 2)}</span>
                            <small>
                              {formatTitleCase(selectedComparison.label)} ·{" "}
                              {isProjectedMode ? "Proyectado" : "Actual ONPE"}
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
                              selectedCode={selectedCode}
                              showOthers={showOthers}
                              comparisonMode={regionalComparisonMode}
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
