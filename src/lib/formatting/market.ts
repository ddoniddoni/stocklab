const integer = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const clock = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
export const number = (value: number | string) =>
  integer.format(typeof value === "string" ? BigInt(value) : value);
export const time = (value: number) => clock.format(value);
export const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${number(value)}`;
export const direction = (value: number) =>
  value > 0 ? "up" : value < 0 ? "down" : "flat";
