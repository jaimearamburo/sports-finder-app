// Totals in the venue dashboard: "$1,479.00" - thousands separators and
// always two decimals, unlike per-unit prices on listing cards ("$28",
// "$26.50" - see formatPrice). AUD, matching PAYMENT_CURRENCY in
// lib/stripe.ts. A plain module, so server and client components share it.
const MONEY = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function formatMoney(amount: number): string {
  return MONEY.format(amount);
}
