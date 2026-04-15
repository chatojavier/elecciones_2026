export const FEATURED_CANDIDATE_CODES = ["8", "35", "16", "10", "14"] as const;

export const CANDIDATE_COLOR_MAP: Record<string, string> = {
  "8": "#b91c1c",
  "35": "#0f766e",
  "16": "#1d4ed8",
  "10": "#d97706",
  "14": "#7c3aed",
  otros: "#475569"
};

export const SNAPSHOT_ENDPOINT = "/.netlify/functions/snapshot";
export const HEALTH_ENDPOINT = "/.netlify/functions/health";
export const STALE_AFTER_MINUTES = 30;
