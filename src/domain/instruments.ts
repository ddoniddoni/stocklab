// Display identity only; no exchange prices or DART identifiers are bundled.
export const instrument = {
  symbol: "005930",
  name: "삼성전자",
  kind: "보통주",
  venue: "SIM",
} as const;
export function searchInstruments(query: string) {
  const value = query.trim().toLocaleLowerCase("ko-KR").replace(/\s/g, "");
  return instrument.name.includes(value) || instrument.symbol.includes(value)
    ? [instrument]
    : [];
}
