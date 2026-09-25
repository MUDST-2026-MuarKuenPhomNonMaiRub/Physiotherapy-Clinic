"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, toggleLocale } = useLanguage();
  const nextLanguage = locale === "en" ? "ภาษาไทย" : "English";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleLocale}
      className={cn("h-9 gap-1.5 px-2.5", className)}
      aria-label={`Switch to ${nextLanguage}`}
      title={`Switch to ${nextLanguage}`}
      data-no-translate
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold">{locale === "en" ? "ไทย" : "EN"}</span>
    </Button>
  );
}
