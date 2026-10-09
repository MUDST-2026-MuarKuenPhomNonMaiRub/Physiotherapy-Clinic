"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  isLocale,
  LANGUAGE_STORAGE_KEY,
  translateText,
  type Locale,
} from "@/lib/i18n";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (value: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const translatableAttributes = ["aria-label", "placeholder", "title"] as const;
const ignoredTags = new Set(["SCRIPT", "STYLE", "CODE", "PRE"]);
const localeChangeEvent = "la-balance-locale-change";

function getLocaleSnapshot(): Locale {
  const savedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLocale(savedLocale) ? savedLocale : "en";
}

function subscribeToLocale(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(localeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(localeChangeEvent, onStoreChange);
  };
}

function shouldIgnore(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(
    element?.closest('[data-no-translate], [translate="no"]') ||
      (element && ignoredTags.has(element.tagName))
  );
}

/**
 * Most screens pre-date i18n and use English literals. This small adapter
 * applies the central catalog at the render boundary, including portal-based
 * dialogs and toast messages, without touching form values or API data.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    subscribeToLocale,
    getLocaleSnapshot,
    (): Locale => "en"
  );
  const textSources = useRef(new WeakMap<Text, string>());
  const attributeSources = useRef(new WeakMap<Element, Map<string, string>>());

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event(localeChangeEvent));
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "th" : "en");
  }, [locale, setLocale]);

  const t = useCallback((value: string) => translateText(value, locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;

    const translateNode = (node: Text) => {
      if (shouldIgnore(node)) return;
      const current = node.nodeValue ?? "";
      let source = textSources.current.get(node);
      if (
        source === undefined ||
        (current !== source && current !== translateText(source, "th"))
      ) {
        source = current;
        textSources.current.set(node, source);
      }
      const translated = translateText(source, locale);
      if (current !== translated) node.nodeValue = translated;
    };

    const translateAttributes = (element: Element) => {
      if (shouldIgnore(element)) return;
      let sources = attributeSources.current.get(element);
      if (!sources) {
        sources = new Map<string, string>();
        attributeSources.current.set(element, sources);
      }
      for (const attribute of translatableAttributes) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        let source = sources.get(attribute);
        if (
          source === undefined ||
          (current !== source && current !== translateText(source, "th"))
        ) {
          source = current;
          sources.set(attribute, source);
        }
        const translated = translateText(source, locale);
        if (current !== translated) element.setAttribute(attribute, translated);
      }
    };

    const scan = (root: Node) => {
      if (root instanceof Text) {
        translateNode(root);
        return;
      }
      if (!(root instanceof Element) || shouldIgnore(root)) return;
      translateAttributes(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        if (current instanceof Text) translateNode(current);
        else if (current instanceof Element) translateAttributes(current);
        current = walker.nextNode();
      }
    };

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateNode(mutation.target as Text);
        if (mutation.type === "attributes") translateAttributes(mutation.target as Element);
        for (const addedNode of mutation.addedNodes) scan(addedNode);
      }
      observe();
    });
    const observe = () =>
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: [...translatableAttributes],
        childList: true,
        characterData: true,
        subtree: true,
      });

    observer.disconnect();
    scan(document.body);
    observe();
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
