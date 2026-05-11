import { type ComparisonItem } from "../../lib/comparison";
import { FeaturedBar } from "../results";

export function FeaturedComparisonSection({
  items
}: {
  items: ComparisonItem[];
}) {
  return (
    <section className="panel" id="comparativa-central">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Comparativa central</p>
          <h2>Candidatos seleccionados, total elección</h2>
        </div>
      </div>

      <div className="featured-bars">
        {items.map((item) => (
          <FeaturedBar key={item.code} item={item} />
        ))}
      </div>
    </section>
  );
}
