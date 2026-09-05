/**
 * Sums currency amounts via integer paise, not floating-point addition —
 * `0.1 + 0.2 !== 0.3` is the classic bug, and money is the one domain where
 * it gets noticed. Amounts are plain JS numbers denominated in rupees (the
 * DTO/response boundary), converted to paise, summed as integers, then
 * converted back.
 */
export function sumAmounts(amounts: number[]): number {
  const totalPaise = amounts.reduce(
    (sum, amount) => sum + Math.round(amount * 100),
    0,
  );
  return totalPaise / 100;
}
