import { useMemo } from "react";

import {
  deriveAppFreshnessStatus,
  getAppFetchAgeMinutes,
  getNextAutoRefreshInMinutes,
  getSourceAgeMinutes,
  getSourceHasNewCut,
  type AppFreshnessStatus
} from "../lib/trust";
import type { ElectionSnapshot, HealthStatus } from "../lib/types";

export type RefreshFeedback = {
  kind: "success" | "error";
  message: string;
} | null;

export type FreshnessTrackingPayload = {
  app_fetch_age_minutes?: number;
  app_freshness_status: AppFreshnessStatus;
  source_age_minutes?: number;
  source_has_new_cut: boolean;
  snapshot_generated_at?: string;
};

export function useFreshnessStatus({
  snapshot,
  health,
  refreshFeedback,
  clockNow
}: {
  snapshot: ElectionSnapshot | null;
  health: HealthStatus | null;
  refreshFeedback: RefreshFeedback;
  clockNow: number;
}) {
  return useMemo(() => {
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
    const trackingPayload: FreshnessTrackingPayload = {
      app_fetch_age_minutes: appFetchAgeMinutes ?? undefined,
      app_freshness_status: appFreshnessStatus,
      source_age_minutes: sourceAgeMinutes ?? undefined,
      source_has_new_cut: sourceHasNewCut,
      snapshot_generated_at: snapshot?.generatedAt ?? undefined
    };

    return {
      appLastSuccessAt,
      appFreshnessStatus,
      nextAutoRefreshInMinutes,
      sourceHasNewCut,
      statusNote,
      trackingPayload
    };
  }, [clockNow, health, refreshFeedback, snapshot]);
}
