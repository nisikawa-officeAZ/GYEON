"use client";

// iOS-safe controlled text input.
//
// Fixes the iPhone bug where selecting a predictive-text / autocomplete
// suggestion (or autofill) leaves a yellow field whose value is not recognized
// by React state. The value is synced into state through EVERY path — normal
// typing, Japanese IME conversion, iOS predictive suggestions, autofill and
// paste — via onChange / onInput / compositionEnd / blur. We never validate or
// clear the field while IME composition is active.

import { useRef } from "react";
import type { InputHTMLAttributes } from "react";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;

export default function ScanInput({ value, onValueChange, onBlur, ...rest }: Props) {
  const composingRef = useRef(false);

  return (
    <input
      {...rest}
      value={value}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        // Commit the finalized IME string.
        composingRef.current = false;
        onValueChange((e.target as HTMLInputElement).value);
      }}
      onChange={(e) => {
        // Always reflect the live value (including mid-IME) so the field shows
        // exactly what the user is entering. No validation/clearing here.
        onValueChange(e.currentTarget.value);
      }}
      onInput={(e) => {
        // Redundant safety net for autofill / predictive selections that may not
        // emit a React change event on some iOS versions.
        if (!composingRef.current) onValueChange((e.currentTarget as HTMLInputElement).value);
      }}
      onBlur={(e) => {
        // Final sync — catches autofilled values that skipped change/input.
        composingRef.current = false;
        onValueChange(e.currentTarget.value);
        onBlur?.(e);
      }}
    />
  );
}
