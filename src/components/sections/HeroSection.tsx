import { formatDateTime, formatRelativeMinutes, formatTime } from "../../lib/format";
import type { AppFreshnessStatus } from "../../lib/trust";

export function HeroSection({
  appLastSuccessAt,
  clockNow,
  nextAutoRefreshInMinutes,
  sourceLastUpdatedAt,
  appFreshnessStatus,
  refreshing,
  statusNote,
  snapshotGeneratedAt,
  onRefreshClick,
  onPrimaryCtaClick,
  onSecondaryCtaClick,
  eyebrow = "Resultados presidenciales 2026",
  title = "Conteo de votos y proyección nacional",
  lede = "Consulta resultados ONPE, compara candidatos y explora regiones y votos extranjeros con datos actualizados.",
  primaryCtaLabel = "Explorar regiones",
  secondaryCtaLabel = "Ver metodología",
  primaryCtaHref = "#lectura-regional",
  secondaryCtaHref = "#metodologia",
  microcopy = "Actualizamos esta vista con nuevos cortes oficiales de ONPE."
}: {
  appLastSuccessAt: string | null;
  clockNow: number;
  nextAutoRefreshInMinutes: number | null;
  sourceLastUpdatedAt: string;
  appFreshnessStatus: AppFreshnessStatus;
  refreshing: boolean;
  statusNote: string;
  snapshotGeneratedAt: string;
  onRefreshClick: () => void;
  onPrimaryCtaClick: () => void;
  onSecondaryCtaClick: () => void;
  eyebrow?: string;
  title?: string;
  lede?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaHref?: string;
  microcopy?: string;
}) {
  return (
    <section className="hero">
      <div className="hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero__lede">{lede}</p>
        <div className="hero__actions">
          <a
            className="hero__cta hero__cta--primary"
            href={primaryCtaHref}
            onClick={onPrimaryCtaClick}
          >
            {primaryCtaLabel}
          </a>
          <a
            className="hero__cta hero__cta--secondary"
            href={secondaryCtaHref}
            onClick={onSecondaryCtaClick}
          >
            {secondaryCtaLabel}
          </a>
        </div>
        <p className="hero__microcopy">{microcopy}</p>
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
            {`${formatRelativeMinutes(sourceLastUpdatedAt, clockNow)} (${formatTime(
              sourceLastUpdatedAt
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
              onClick={onRefreshClick}
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
            Snapshot visible: {formatDateTime(snapshotGeneratedAt)}
          </small>
        </div>
      </div>
    </section>
  );
}
