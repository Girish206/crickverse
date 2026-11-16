import type { ChangeEvent } from "react";
import InputComp from "../dms/components/InputComp";

// The search box above a list of players, tournaments etc.: the app's usual
// InputComp field with a search icon.
export function SearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="cricket-list-search">
      <InputComp
        label={label}
        aria-label={label}
        icon="fa-solid fa-magnifying-glass"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </div>
  );
}
