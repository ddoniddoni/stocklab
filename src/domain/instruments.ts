// Display identity only. Starting prices are authored simulation constants.
export const instruments = [
  { symbol: "005930", name: "삼성전자", initialPrice: 70_000 },
  { symbol: "000660", name: "SK하이닉스", initialPrice: 110_000 },
  { symbol: "035420", name: "NAVER", initialPrice: 160_000 },
  { symbol: "005380", name: "현대자동차", initialPrice: 190_000 },
  { symbol: "066570", name: "LG전자", initialPrice: 90_000 },
].map((stock) => ({ ...stock, kind: "보통주", venue: "SIM" as const }));
export type Instrument = (typeof instruments)[number];
export const instrument = instruments[0]!;
export function getInstrument(symbol: string) {
  return instruments.find((stock) => stock.symbol === symbol);
}
export function searchInstruments(query: string) {
  const normalize = (value: string) =>
    value.trim().toLocaleLowerCase("ko-KR").replace(/\s/g, "");
  const value = normalize(query);
  return instruments.filter(
    (stock) =>
      normalize(stock.name).includes(value) || stock.symbol.includes(value),
  );
}
