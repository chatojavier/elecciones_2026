type AnalyticsValue = string | number | boolean | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

type GtagCommand = "js" | "config" | "event";
type Gtag = (command: GtagCommand, target: string | Date, params?: AnalyticsParams) => void;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: Gtag;
  }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "";
const scriptId = "google-analytics-script";

let initialized = false;
let initialPageViewTracked = false;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = function gtag(command, target, params) {
      window.dataLayer.push([command, target, params]);
    };
  }
}

function injectScript() {
  if (document.getElementById(scriptId)) {
    return;
  }

  const script = document.createElement("script");
  script.id = scriptId;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

export function isAnalyticsEnabled() {
  return measurementId.length > 0;
}

export function initializeAnalytics() {
  if (!isBrowser() || !isAnalyticsEnabled() || initialized) {
    return;
  }

  ensureGtag();
  injectScript();

  window.gtag?.("js", new Date());
  window.gtag?.("config", measurementId, {
    send_page_view: false
  });

  initialized = true;
}

export function trackPageView(pagePath?: string) {
  if (!isBrowser() || !isAnalyticsEnabled()) {
    return;
  }

  initializeAnalytics();

  window.gtag?.("event", "page_view", {
    page_title: document.title,
    page_location: window.location.href,
    page_path: pagePath ?? window.location.pathname
  });
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!isBrowser() || !isAnalyticsEnabled()) {
    return;
  }

  initializeAnalytics();
  window.gtag?.("event", eventName, params);
}

export function trackInitialPageView() {
  if (initialPageViewTracked) {
    return;
  }

  trackPageView();
  initialPageViewTracked = true;
}
