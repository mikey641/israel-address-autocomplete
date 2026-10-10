// Small pure helpers shared by the React component and server code.

export interface AddressParts {
  street: string;
  houseNumber?: string;
  entrance?: string;
}

/** "הרצל 10 כניסה א" — the single-line form most Israeli forms and documents use. */
export function formatAddress({ street, houseNumber, entrance }: AddressParts): string {
  const line = [street.trim(), houseNumber?.trim() ?? ""].filter(Boolean).join(" ");
  const e = entrance?.trim();
  return e ? `${line} כניסה ${e}` : line;
}

/**
 * Best-effort split of a legacy free-text address ("רחוב הרצל 12א") into street and house number.
 * Returns the whole string as the street when no trailing number is present.
 */
export function splitAddress(address: string): { street: string; houseNumber: string } {
  const a = address.trim();
  const m = a.match(/^(.*?)\s+(\d+[א-ת]?(?:-\d+)?)\s*$/);
  return m ? { street: m[1] ?? "", houseNumber: m[2] ?? "" } : { street: a, houseNumber: "" };
}
