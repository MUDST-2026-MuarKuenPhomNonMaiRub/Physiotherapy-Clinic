"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type NumberInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
};

/**
 * A number box that can be cleared and typed over. Binding a number input
 * straight to a number state cannot do that: the empty box parses to 0 and is
 * written straight back (or clamped up to the minimum), so "1" can never be
 * deleted to make room for "3".
 *
 * The text being typed is kept as typed. A value is reported as soon as it
 * parses and lies within min–max; leaving the box puts back the nearest allowed
 * value, or the last good one if the box was left empty. Leaving happens before
 * a button's click lands, so a dialog's confirm button always sees that value.
 */
export function NumberInput({ value, onValueChange, min, max, onBlur, ...props }: NumberInputProps) {
  // null while the box is not being edited: it then shows `value` itself.
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  return (
    <Input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== "" && Number.isFinite(n) && n === clamp(n)) onValueChange(n);
      }}
      onBlur={(e) => {
        if (draft !== null) {
          const n = Number(draft);
          if (draft.trim() !== "" && Number.isFinite(n) && clamp(n) !== value) onValueChange(clamp(n));
          setDraft(null);
        }
        onBlur?.(e);
      }}
    />
  );
}
