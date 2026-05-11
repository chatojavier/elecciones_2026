import { QuickInsightsSkeleton } from "./QuickInsightsSection";

export function LoadingScreen() {
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

export function ErrorScreen({
  error
}: {
  error: string | null;
}) {
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
