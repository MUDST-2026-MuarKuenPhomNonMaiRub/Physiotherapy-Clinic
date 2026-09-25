import { thaiPatterns, thaiTranslations, type Locale } from "@/lib/i18n/translations";

export const LANGUAGE_STORAGE_KEY = "la-balance-locale";

function splitWhitespace(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return { leading, trailing, core: value.slice(leading.length, value.length - trailing.length) };
}

/** Translate one rendered UI phrase while leaving unknown data untouched. */
export function translateText(value: string, locale: Locale): string {
  if (locale === "en" || !value.trim()) return value;

  const { leading, trailing, core } = splitWhitespace(value);
  const normalized = core.replace(/\s+/g, " ");
  const exact = thaiTranslations[normalized];
  if (exact) return `${leading}${exact}${trailing}`;

  for (const entry of thaiPatterns) {
    const match = normalized.match(entry.pattern);
    if (match) return `${leading}${entry.replace(...match)}${trailing}`;
  }

  return value;
}

export function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "th";
}

export type { Locale } from "@/lib/i18n/translations";
