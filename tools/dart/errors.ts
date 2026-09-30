export const errorMessages = {
  INVALID_INPUT: "인자 또는 로컬 데이터 형식이 올바르지 않습니다.",
  NOT_CONFIGURED: "로컬 .env.local에 DART_API_KEY(40자리)를 설정하세요.",
  FORBIDDEN: "수집 도구는 APP_ENV=local인 개인 로컬 환경에서만 실행할 수 있습니다.",
  AUTH: "DART 인증키·IP·계정 권한을 확인하세요. 인증 오류는 재시도하지 않습니다.",
  RATE_LIMITED: "DART 요청 한도에 도달했습니다. 자동 재시도 없이 중단합니다.",
  BUDGET: "이 수집 실행의 누적 요청 예산을 모두 사용했습니다.",
  UPSTREAM: "DART 응답을 받지 못했습니다. 나중에 같은 실행을 재개할 수 있습니다.",
  SCHEMA: "DART 응답 형식 또는 회사·보고서 식별자가 일치하지 않습니다.",
  TOO_LARGE: "응답 또는 압축 해제 크기가 도구의 제한을 초과했습니다.",
  CANCELLED: "수집을 중단했습니다. 저장된 실행 ID로 재개할 수 있습니다.",
  LOCKED: "다른 수집 도구가 실행 중이거나 이전 잠금이 남아 있습니다.",
  INTEGRITY: "저장된 원천의 해시 또는 수집 이력이 일치하지 않습니다.",
  REVIEW_REQUIRED: "원문 대조 기록이 부족하거나 수집 원천과 일치하지 않습니다.",
  IO: "로컬 수집 파일을 읽거나 저장하지 못했습니다.",
} as const;
export type ErrorCode = keyof typeof errorMessages;
export class DartError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(errorMessages[code]);
    this.name = "DartError";
    this.code = code;
  }
}
export function fail(code: ErrorCode): never { throw new DartError(code); }
export function safeError(error: unknown) {
  return error instanceof DartError ? error : new DartError("IO");
}
// Never emit an upstream message, error cause/stack, request URL, or credentials.
export function printError(error: unknown) {
  const safe = safeError(error);
  console.error(`${safe.code}: ${safe.message}`);
  process.exitCode = safe.code === "CANCELLED" ? 130 : 1;
}
