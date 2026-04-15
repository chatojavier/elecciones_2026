export const FEATURED_CANDIDATE_LIMIT = 5;
export const FEATURED_CANDIDATE_COLORS = [
  "#b91c1c",
  "#0f766e",
  "#1d4ed8",
  "#d97706",
  "#7c3aed"
] as const;
export const OTHER_CANDIDATE_COLOR = "#475569";

export function getCandidateColor(code: string, featuredCodes: string[]) {
  if (code === "otros") {
    return OTHER_CANDIDATE_COLOR;
  }

  const index = featuredCodes.indexOf(code);

  if (index === -1) {
    return "#94a3b8";
  }

  return FEATURED_CANDIDATE_COLORS[index % FEATURED_CANDIDATE_COLORS.length];
}

export const SNAPSHOT_ENDPOINT = "/.netlify/functions/snapshot";
export const SYNC_ENDPOINT = "/.netlify/functions/sync";
export const DEV_REFRESH_ENDPOINT = "/api/refresh-snapshot";
export const HEALTH_ENDPOINT = "/.netlify/functions/health";
export const STALE_AFTER_MINUTES = 30;
