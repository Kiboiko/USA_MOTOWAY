// Minimal US phone check, shared by the forms and the API so the browser and
// the server can never disagree about what is acceptable.
//
// Deliberately length-only: 10 digits, or 11 when prefixed with the country
// code 1. No area-code rules — a stricter structural check still could not tell
// an unassigned area code from a real one, and would risk rejecting genuine
// customers for no real gain.

export const US_PHONE_HINT = "Enter a 10-digit US phone number, e.g. (206) 555-0123.";

/** Returns the 10 national digits, or null if the input is not a US-length number. */
function nationalDigits(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");

  // An explicit "+" prefix must be the US country code; "+7 900…" is not a US number.
  if (raw.startsWith("+") && !digits.startsWith("1")) return null;

  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

export function isValidUsPhone(input: string): boolean {
  return nationalDigits(input) !== null;
}

/** Human-readable form for emails and the leads sheet: (206) 555-0123. */
export function formatUsPhone(input: string): string | null {
  const d = nationalDigits(input);
  return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
}
