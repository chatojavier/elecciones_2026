import { getCandidateColor } from "../../lib/constants";
import { formatPercent, formatTitleCase } from "../../lib/format";
import type { ComparableScope } from "../../lib/types";

export function CandidateStack({
  scope,
  showOthers
}: {
  scope: ComparableScope;
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
