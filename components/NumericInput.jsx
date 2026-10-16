"use client";

import { useState } from "react";
import { finishNumberDraft, isNumberDraft } from "@/lib/workout-input";

export default function NumericInput({ value, onChange, max = 1000, ...props }) {
  const [draft, setDraft] = useState(null);
  return <input {...props} type="text" inputMode="decimal" autoComplete="off"
    value={draft ?? value ?? ""}
    onChange={(event) => {
      const next = event.target.value;
      if (!isNumberDraft(next, max)) return;
      setDraft(next);
      onChange(finishNumberDraft(next, max));
    }}
    onBlur={(event) => {
      if (draft !== null) onChange(finishNumberDraft(draft, max));
      setDraft(null);
      props.onBlur?.(event);
    }} />;
}
