// Minimal email check, shared by the forms and the API so the browser and the
// server can never disagree about what is acceptable.
//
// Deliberately shallow: exactly one "@", something either side, and a dot in
// the domain. Anything stricter starts rejecting valid real-world addresses,
// and only sending mail can truly prove an address works.

export const EMAIL_HINT = "Enter a valid email address, e.g. name@example.com.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(input: string): boolean {
  const value = input.trim();
  return value.length <= 200 && EMAIL_PATTERN.test(value);
}
