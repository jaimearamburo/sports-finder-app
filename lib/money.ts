// Dashboard totals: "$1,479.00", with separators and two decimals (unlike card
// prices, see formatPrice). AUD, matching PAYMENT_CURRENCY. Shared by server
// and client components.
const MONEY = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function formatMoney(amount: number): string {
  return MONEY.format(amount);
}
