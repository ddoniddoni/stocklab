export type ParsedAmount = { value: string | null; reason: string | null };

/** Keep integer won amounts exact across JSON boundaries. */
export function parseAmount(raw: string | null | undefined): ParsedAmount {
  const text = raw?.trim().replace(/−/g, "-") ?? "";
  if (!text || ["-", "—", "–"].includes(text))
    return { value: null, reason: "원천에 금액이 제공되지 않았습니다." };
  const parenthesized = /^\(.+\)$/.test(text);
  const numeric = parenthesized ? text.slice(1, -1).trim() : text;
  if (
    numeric.length > 100 ||
    !(parenthesized
      ? /^(?:\d+|\d{1,3}(?:,\d{3})+)$/
      : /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)$/
    ).test(numeric)
  )
    return { value: null, reason: "원 단위 정수로 해석할 수 없는 금액입니다." };
  const value = BigInt(numeric.replaceAll(",", ""));
  return { value: (parenthesized ? -value : value).toString(), reason: null };
}

export function exactWon(value: string | null) {
  return value === null ? "—" : `${BigInt(value).toLocaleString("ko-KR")}원`;
}

/** Rounded only at presentation time; no Number conversion of source amounts. */
export function compactWon(value: string | null) {
  if (value === null) return "—";
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  const unit = absolute >= 1_000_000_000_000n
    ? { divisor: 1_000_000_000_000n, label: "조 원" }
    : absolute >= 100_000_000n
      ? { divisor: 100_000_000n, label: "억 원" }
      : { divisor: 1n, label: "원" };
  if (unit.divisor === 1n) return exactWon(value);
  const tenths = (absolute * 10n + unit.divisor / 2n) / unit.divisor;
  return `${amount < 0n ? "−" : ""}${(tenths / 10n).toLocaleString("ko-KR")}.${tenths % 10n}${unit.label}`;
}

export function operatingMargin(profit: string | null, revenue: string | null) {
  if (profit === null || revenue === null || BigInt(revenue) <= 0n) return null;
  const numerator = BigInt(profit) * 1000n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const denominator = BigInt(revenue);
  const tenths = (absolute + denominator / 2n) / denominator;
  return `${numerator < 0n && tenths !== 0n ? "−" : ""}${tenths / 10n}.${tenths % 10n}%`;
}

/** Only a bounded display ratio is converted to Number, never the won amount. */
export function barPercent(value: string, maximum: bigint) {
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return maximum === 0n ? 0 : Number((absolute * 10_000n) / maximum) / 100;
}
