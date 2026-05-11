export function ComparisonCell({
  votes,
  percentage,
  detail
}: {
  votes: string;
  percentage: string;
  detail: string;
}) {
  return (
    <div className="comparison-cell">
      <strong>{votes}</strong>
      <span>{percentage}</span>
      <small>{detail}</small>
    </div>
  );
}
