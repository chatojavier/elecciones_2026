import type {
  ElectionSnapshot,
  ForeignContinentResult,
  ForeignCountryResult,
  ForeignResult
} from "./types";

type LegacyForeignResult = Omit<ForeignResult, "continents"> & {
  continents?: unknown;
};

type LegacyForeignContinentResult = Omit<ForeignContinentResult, "countries"> & {
  countries?: unknown;
};

function normalizeForeignCountries(countries: unknown): ForeignCountryResult[] {
  if (!Array.isArray(countries)) {
    return [];
  }

  return countries.map((country) => ({
    ...(country as ForeignCountryResult),
    kind: "foreign_country"
  }));
}

function normalizeForeignContinents(continents: unknown): ForeignContinentResult[] {
  if (!Array.isArray(continents)) {
    return [];
  }

  return continents.map((continent) => {
    const rawContinent = continent as LegacyForeignContinentResult;

    return {
      ...(rawContinent as ForeignContinentResult),
      kind: "foreign_continent",
      countries: normalizeForeignCountries(rawContinent.countries)
    };
  });
}

export function normalizeElectionSnapshot(snapshot: ElectionSnapshot): ElectionSnapshot {
  const rawForeign = snapshot.foreign as LegacyForeignResult;

  return {
    ...snapshot,
    foreign: {
      ...(rawForeign as ForeignResult),
      kind: "foreign_total",
      continents: normalizeForeignContinents(rawForeign.continents)
    }
  };
}
