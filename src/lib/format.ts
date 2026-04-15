export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

const SPANISH_LOWERCASE_WORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "e",
  "el",
  "en",
  "la",
  "las",
  "los",
  "o",
  "por",
  "u",
  "y"
]);

function capitalizeWord(word: string) {
  if (!word) {
    return word;
  }

  return `${word.charAt(0).toLocaleUpperCase("es-PE")}${word.slice(1)}`;
}

export function formatTitleCase(value: string) {
  const words = value
    .trim()
    .toLocaleLowerCase("es-PE")
    .split(/\s+/);

  return words
    .map((word, index) => {
      const normalizedWord = word
        .split("-")
        .map((segment) => capitalizeWord(segment))
        .join("-");

      const isFirstWord = index === 0;
      const isLastWord = index === words.length - 1;

      if (!isFirstWord && !isLastWord && SPANISH_LOWERCASE_WORDS.has(word)) {
        return word;
      }

      return normalizedWord;
    })
    .join(" ");
}

export function formatPercent(value: number, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

export function formatSignedNumber(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(value))}`;
}

export function formatSignedDecimal(value: number, digits = 2) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("es-PE", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getElapsedMinutes(value: string, now = Date.now()) {
  const diffMs = now - new Date(value).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

export function formatRelativeMinutes(value: string, now = Date.now()) {
  const minutes = getElapsedMinutes(value, now);

  if (minutes < 1) {
    return "hace unos segundos";
  }

  if (minutes === 1) {
    return "hace 1 minuto";
  }

  if (minutes < 60) {
    return `hace ${minutes} minutos`;
  }

  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}
