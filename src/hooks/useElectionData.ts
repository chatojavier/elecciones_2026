import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAppData, refreshAppData } from "../lib/api";
import { trackEvent } from "../lib/analytics";
import {
  deriveAppFreshnessStatus,
  getAppFetchAgeMinutes,
  getSourceAgeMinutes,
  getSourceHasNewCut
} from "../lib/trust";
import type { ElectionRound, ElectionSnapshot, HealthStatus } from "../lib/types";
import type { RefreshFeedback } from "./useFreshnessStatus";

const AUTO_REFRESH_FAILURE_RETRY_MS = 5 * 60 * 1000;

export function useElectionData({
  clockNow,
  round = "first"
}: {
  clockNow: number;
  round?: ElectionRound;
}) {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<RefreshFeedback>(null);
  const lastAutoRefreshKeyRef = useRef<string | null>(null);
  const autoRefreshRetryAfterRef = useRef<number | null>(null);
  const snapshotRef = useRef<ElectionSnapshot | null>(null);
  const healthRef = useRef<HealthStatus | null>(null);
  const clockNowRef = useRef(clockNow);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    healthRef.current = health;
  }, [health]);

  useEffect(() => {
    clockNowRef.current = clockNow;
  }, [clockNow]);

  const loadAppData = useCallback(
    async (options: { background?: boolean; trigger?: "initial" | "manual" | "auto" } = {}) => {
      const { background = false, trigger = "initial" } = options;

      if (background) {
        setRefreshing(true);
        setRefreshFeedback(null);
      } else {
        setLoading(true);
      }

      try {
        const previousSnapshot = snapshotRef.current;
        const data = background ? await refreshAppData(round) : await fetchAppData(round);

        setSnapshot(data.snapshot);
        setHealth(data.health);
        setError(null);
        autoRefreshRetryAfterRef.current = null;
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
            app_fetch_age_minutes:
              getAppFetchAgeMinutes(data.health.lastSuccessAt, clockNowRef.current) ?? undefined,
            app_freshness_status: deriveAppFreshnessStatus(data.health.lastSuccessAt, clockNowRef.current),
            source_age_minutes: getSourceAgeMinutes(data.snapshot.sourceLastUpdatedAt, clockNowRef.current),
            source_has_new_cut: sourceHasNewCut,
            snapshot_generated_at: data.snapshot.generatedAt,
            round
          });
        }
      } catch (reason) {
        const message = (reason as Error).message;

        if (background && trigger === "auto") {
          autoRefreshRetryAfterRef.current = Date.now() + AUTO_REFRESH_FAILURE_RETRY_MS;
        }

        if (background && snapshotRef.current) {
          const currentSnapshot = snapshotRef.current;
          const currentHealth = healthRef.current;

          if (trigger === "manual") {
            setRefreshFeedback({
              kind: "error",
              message: "No se pudo actualizar. Intenta nuevamente."
            });
            trackEvent("refresh_manual_error", {
              app_fetch_age_minutes:
                getAppFetchAgeMinutes(currentHealth?.lastSuccessAt ?? null, clockNowRef.current) ?? undefined,
              app_freshness_status: deriveAppFreshnessStatus(
                currentHealth?.lastSuccessAt ?? null,
                clockNowRef.current
              ),
              source_age_minutes: currentSnapshot
                ? getSourceAgeMinutes(currentSnapshot.sourceLastUpdatedAt, clockNowRef.current)
                : undefined,
              source_has_new_cut: currentSnapshot
                ? getSourceHasNewCut(
                  currentSnapshot.sourceLastUpdatedAt,
                  currentHealth?.lastSuccessAt ?? null,
                  currentSnapshot.sourceLastUpdatedAt
                )
                : undefined,
              snapshot_generated_at: currentSnapshot?.generatedAt,
              error_message: message,
              round
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
    },
    [round]
  );

  const loadInitial = useCallback(async () => {
    await loadAppData();
  }, [loadAppData]);

  const refreshManual = useCallback(async () => {
    await loadAppData({ background: true, trigger: "manual" });
  }, [loadAppData]);

  const refreshAuto = useCallback(async () => {
    await loadAppData({ background: true, trigger: "auto" });
  }, [loadAppData]);

  const maybeRefreshAuto = useCallback(
    async ({
      appLastSuccessAt,
      shouldRefresh,
      refreshKey,
      now
    }: {
      appLastSuccessAt: string | null;
      shouldRefresh: boolean;
      refreshKey: string;
      now: number;
    }) => {
      if (!snapshot || loading || refreshing || !shouldRefresh || !appLastSuccessAt) {
        return;
      }

      if (lastAutoRefreshKeyRef.current === refreshKey) {
        const retryAfter = autoRefreshRetryAfterRef.current;
        if (!retryAfter || now < retryAfter) {
          return;
        }
      }

      lastAutoRefreshKeyRef.current = refreshKey;
      autoRefreshRetryAfterRef.current = null;
      await refreshAuto();
    },
    [loading, refreshAuto, refreshing, snapshot]
  );

  return {
    data: {
      snapshot,
      health,
      error,
      loading,
      refreshing,
      refreshFeedback
    },
    actions: {
      loadInitial,
      refreshManual,
      refreshAuto,
      maybeRefreshAuto
    }
  };
}
