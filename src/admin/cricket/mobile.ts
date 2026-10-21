// Same rule as the server (portfolio-server src/utils/mobile.ts): digits
// only, an Indian "+91" / "91" / leading "0" dropped, 10–15 digits left.
export function normalizeMobile(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

// "9876543210" → "98765 43210".
export const formatMobile = (mobile: string) =>
  mobile.length === 10 ? `${mobile.slice(0, 5)} ${mobile.slice(5)}` : mobile;
