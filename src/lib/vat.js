// Israel VAT rate. price_per_plate (and event revenue generally) is entered
// VAT-inclusive; this is used to back out the VAT-exclusive figure for
// reporting.
export const VAT_RATE = 0.18;

export function excludeVat(amountIncludingVat) {
  const amount = parseFloat(amountIncludingVat) || 0;
  return amount / (1 + VAT_RATE);
}
