# 03. 데이터 모델과 외부 연동 계약

문서 버전: 1.0 | 공식 문서 확인일: 2026-09-30

**상태:** 공식 문서와 공개 샘플을 확인한 설계다. 실제 계정의 키 발급, 인증 성공, 유량 한도, 실시간 패킷 수신은 아직 검증하지 않았다. 아래 프로젝트 API는 우리가 구현할 API이며 공급자가 제공하는 경로와 구분한다.

## 1. 원천별 허용 범위와 출처

| 원천 | 사용 범위 | 공개 처리 |
|---|---|---|
| 직접 작성한 합성 시나리오 | 공개 데모의 시세/차트/호가/체결 | 생성기, seed, 버전 표시 |
| 한국투자 Open API | 본인의 허용된 로컬 연동 | 원본/가공 시세/과거 녹화 공개 금지 정책 |
| OpenDART | 기업 개황, 공시, 공시된 재무 | 이용조건 확인, 원문/기간/수집일/가공 내역 표시 |
| 별도 허가 데이터셋 | MVP에서 미사용 | 향후 계약의 공개 표시 범위 검토 후 추가 |
| 증권사 예상 실적/컨센서스 | 미사용 | DART 데이터라고 표시하거나 임의 생성 금지 |

한투는 외부 시세 제공에 거래소 정보이용계약 관련 조건을 안내한다. 실시간이 아니라 과거 데이터라는 이유만으로 공개 허가가 생기지 않는다. [S01]

OpenDART는 공시원문 추출과 재무정보 활용을 안내한다. 이용조건과 제출인 책임, 정확성/완전성에 대한 한계가 있으므로 `공식 데이터니까 무조건 정확하다`, `어떤 형태의 재배포든 무제한 허용된다`고 표현하지 않는다. 가입 시 사용 목적과 확인 URL을 실제 프로젝트에 맞게 기재한다. [S05][S06][S07]

## 2. 식별자와 금액

### 2.1 회사와 종목을 구분한다

- `corpCode`: DART 공시 법인을 나타내는 8자리 문자열.
- `symbol`: 국내 주식의 6자리 코드 문자열.
- 회사와 종목은 별개다. 한 법인에 여러 종류의 주식이 연결될 수 있다.
- 초기에는 지원 목록의 보통주만 제공한다.
- `000660`을 숫자 660으로 변환하지 않는다.
- DART corpCode 압축파일로 매핑하고 기업개황의 결산월/법인구분을 확인한다. corpCode 응답은 확장자가 XML이지만 실제 ZIP 바이너리다. [S08][S09]

### 2.2 정밀도와 시간

국내 주가의 원 단위 정수는 안전한 정수 범위 검증 후 number를 사용할 수 있다. 재무 금액은 JSON/DB 경계에서 정규화된 십진 문자열로 저장한다. 계산은 BigInt 또는 decimal 연산을 사용한다. 큰 원 단위 수치를 바로 Number로 바꾸지 않는다.

빈 값, 대시, 미제공과 0을 구분한다. 쉼표/괄호 음수/음수 기호는 테스트된 parser로 처리하고 숫자가 아닌 값은 `null + reason`이다.

이벤트 시각은 UTC epoch milliseconds와 거래일을 구분한다. UI는 Asia/Seoul로 보여준다. 일봉 날짜는 `YYYY-MM-DD`의 거래일이고 순간 시각으로 억지 변환하지 않는다. API가 초까지만 주면 밀리초 정확도를 만들어내지 않는다.

## 3. 시장 데이터 계약

다음은 구현할 타입의 기준이다. 실제 코드에서는 Zod 런타임 스키마와 일치시킨다.

```ts
export type MarketSource = 'synthetic' | 'kis-private';
export type MarketChannel = 'quote' | 'trade' | 'orderbook';
export type ConnectionState =
  | 'idle' | 'connecting' | 'live' | 'paused'
  | 'reconnecting' | 'stale' | 'error' | 'market-closed';

export type MarketMeta = {
  source: MarketSource;
  venue: 'KRX' | 'SIM';
  symbol: string;
  sessionId: string;
  sequence: number; // 공급 adapter의 세션 내 전달 순서, 거래소 고유 ID 아님
  eventTimeMs: number;
  receivedAtMs: number;
};

export type Quote = MarketMeta & {
  lastPrice: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  cumulativeVolume: string | null;
};

export type Trade = MarketMeta & {
  price: number;
  quantity: number;
  aggressor: 'buy' | 'sell' | 'unknown';
};

export type OrderBook = MarketMeta & {
  kind: 'snapshot';
  asks: Array<{ price: number; quantity: number }>;
  bids: Array<{ price: number; quantity: number }>;
};

export type CandleTime =
  | { kind: 'trading-date'; date: string }
  | { kind: 'instant'; epochMs: number };

export type Candle = {
  time: CandleTime;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
};

export type HistoryQuery = {
  symbol: string;
  interval: '1d' | '1m';
  from: string;
  to: string;
};

export type HistoryResult = {
  source: MarketSource;
  candles: Candle[];
  adjustment: 'raw' | 'adjusted' | 'synthetic';
  completeness: 'complete' | 'partial';
  warnings: string[];
};

export type MarketEvent =
  | { type: 'quote'; payload: Quote }
  | { type: 'trade'; payload: Trade }
  | { type: 'orderbook'; payload: OrderBook }
  | { type: 'status'; state: ConnectionState; message?: string }
  | { type: 'reset'; sessionId: string };

export interface MarketProvider {
  readonly source: MarketSource;
  connect(): Promise<void>;
  getHistory(query: HistoryQuery, signal?: AbortSignal): Promise<HistoryResult>;
  subscribe(
    request: { symbol: string; channels: MarketChannel[] },
    listener: (event: MarketEvent) => void,
  ): () => void;
  dispose(): void;
}
```

계약 규칙:
- subscribe가 돌려주는 cleanup은 해당 listener만 해제한다. 마지막 listener가 없어질 때 upstream 구독을 해제한다.
- dispose는 타이머, 소켓, Worker, listener를 모두 정리하며 반복 호출해도 안전하다.
- 동일 이벤트를 여러 컴포넌트가 소비해도 upstream 연결이 늘지 않는다.
- `source`와 `venue`를 저장키, 조회키, 상태 구분에 포함하여 synthetic/KIS 캐시를 섞지 않는다.
- source가 synthetic이면 venue는 SIM, kis-private이면 venue는 KRX인지 런타임 스키마에서 검증한다.
- history의 from/to는 1d에서 거래일 문자열, 1m에서 명확한 시간대가 있는 ISO 시각으로 검증한다.
- 가격 등락과 공격 매수/매도는 다르다. 공급자의 확실한 의미를 확인하지 못하면 aggressor는 unknown이다.
- 호가 배열은 도메인에서 asks 오름차순, bids 내림차순으로 정규화하고 화면 배치만 별도로 조정한다.
- 기록/재생 기능이 추가되더라도 source와 공개 허용성은 별도 검증한다.

## 4. 한투 연동

### 4.1 실제로 사용할 최소 API

| 기능 | 공식 경로 또는 TR ID | 이 프로젝트의 용도 |
|---|---|---|
| REST 토큰 | 공식 auth 예제의 `/oauth2/tokenP` | 로컬 인증, 만료값에 따라 재사용 |
| WS 접속키 | `/oauth2/Approval` | 로컬 WebSocket 승인키 |
| 현재가 | `/uapi/domestic-stock/v1/quotations/inquire-price` | 상세 진입 시 초기 스냅샷 |
| 기간별 가격 | `/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice` | 과거 일봉 |
| KRX 실시간 체결가 | `H0STCNT0` | 체결과 현재가 갱신 |
| KRX 실시간 호가 | `H0STASP0` | 호가 스냅샷 |

경로/필드 근거는 [S02][S03][S04][S17][S18][S19]다. 공식 샘플은 Python이지만 이 프로젝트는 TypeScript로 프로토콜을 구현한다. 샘플 저장소의 uv/Python 환경을 프로젝트 필수 스택으로 가져오지 않는다.

KIS의 `demo` 계정은 증권사 모의투자 환경을 뜻한다. 우리 서비스의 `synthetic` 공개 데모와 다르다. 환경 이름을 혼용하지 않는다.

REST 현재가의 시장 구분은 이번 범위에서 KRX다. NXT/통합 채널을 섞지 않는다. 실제 주문 체결통보 API는 시장 전체 체결가와 다르며 개인정보가 포함될 수 있으므로 구현하지 않는다.

### 4.2 구현 순서

1. 공식 포털에서 본인의 계정과 이용 목적, 신청 조건을 확인한다.
2. App Key/Secret을 로컬 중계 환경파일에만 설정한다.
3. REST 토큰과 WS approval key를 각각 관리한다.
4. 종목 하나의 현재가 REST 요청을 테스트한다.
5. 종목 하나의 체결 구독을 테스트한다.
6. 호가 구독을 추가한다.
7. 페이지 이동/해제/재접속/잘못된 티켓 테스트를 완료한다.

필요 키가 없으면 synthetic 인터페이스 구현과 계약 테스트를 계속하되 실제 연동 완료로 기록하지 않는다.

### 4.3 프레임 파서

공식 인증/WS 샘플을 기준으로 제어 JSON, heartbeat, 데이터 프레임을 구분한다. `JSON.parse`를 모든 프레임에 무조건 적용하지 않는다. 구분자 기반 데이터는 레코드 수, 필드 수, TR별 컬럼 순서를 검증한다. [S17][S18]

파서에 숫자 인덱스를 화면 코드까지 퍼뜨리지 않는다. 한 모듈의 이름 있는 컬럼 맵으로 관리하고 참조한 공식 저장소 commit SHA를 구현 시 기록한다.

반드시 검사할 사례:
- 연결/구독 성공과 실패, ping/pong
- 1개 프레임에 여러 레코드
- 누락된 필드와 새 필드 추가
- 잘못된 가격, 공백 수량, 비정상 종목
- 거래일 경계와 시간 정렬
- 소켓 재연결 뒤 sequence/session 재설정

형식이 바뀌면 정상처럼 0을 표시하지 말고 schema 오류와 제한된 진단 정보를 남긴다. 키, 토큰, 실제 원본 프레임 전체를 로깅하지 않는다.

### 4.4 REST 초기값과 실시간 경합

REST 요청 중 WS 이벤트가 먼저 도착할 수 있다. 나중에 끝난 오래된 REST 응답이 최신 WS 값을 덮어쓰지 않게 한다. 수신 버퍼 또는 일관된 시점 정책을 구현하고 테스트한다.

일봉은 응답 한도에 맞춰 날짜 범위를 나누어 수집하고 거래일로 정렬/중복 제거한다. 공식 기간별 예제는 1회 최대 100건을 안내하므로 `한 번에 5년치`를 가정하지 않는다. 원주가/수정주가 플래그를 보존하며 서로 다른 기준의 시계열을 이어 붙이지 않는다. [S04]

### 4.5 호출 예산

이전 대화에 나온 `18회`, `41개`를 고정된 최신 보장값으로 사용하지 않는다. 실제 적용 한도는 계정, 환경, 공지 기준으로 P5에서 확인한다.

프로젝트 시작값: REST 최대 초당 2회, WS upstream 1개, 등록 단위 최대 10개. 체결과 호가는 별도 등록으로 계산한다. 한도 오류 시 증가가 아니라 요청 큐/캐시/백오프로 대응한다. 요청 한도를 여러 키나 병렬 세션으로 우회하지 않는다.

## 5. OpenDART 연동

### 5.1 필요한 API

| 기능 | 공식 URL | 처리 |
|---|---|---|
| 고유번호 | `https://opendart.fss.or.kr/api/corpCode.xml` | ZIP 해제 후 회사/종목 매핑 |
| 기업 개황 | `https://opendart.fss.or.kr/api/company.json` | 법인구분, 결산월 등 |
| 공시 목록 | `https://opendart.fss.or.kr/api/list.json` | 기업별 공시/정정 내역 |
| 전체 재무제표 | `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` | 연결/별도와 보고서별 원천 |

요청은 로컬 수집 도구가 수행하며 인증키는 응답 DTO나 로그에 남기지 않는다. corpCode ZIP은 파일 수, 해제 크기, 경로를 제한하고 XML 파서의 외부 엔티티 처리를 비활성화한다. [S08][S09][S16][S20]

### 5.2 보고서 요청 계약

```text
crtfc_key = 서버용 인증키
corp_code = 8자리 공시 법인 코드
bsns_year = 사업연도
reprt_code = 11013(1분기), 11012(반기), 11014(3분기), 11011(사업보고서)
fs_div = CFS(연결) 또는 OFS(별도)
```

분기와 연간 재무정보는 API가 제공하는 범위만 사용한다. 전체 재무제표 가이드는 2015년 이후 정보 제공을 안내하지만 모든 회사/연도/보고서가 존재하는 것은 아니다. [S20]

공시 검색은 허용 기간과 페이지 크기로 나누어 요청한다. 마지막 페이지까지 pagination하되 실행당 최대 요청 예산을 둔다. 정정 제출 여부를 보존하고 실제 원문 링크는 접수번호로 구성한다. [S16]

### 5.3 오류와 수집 예산

HTTP 성공과 API 본문의 업무 성공 상태를 둘 다 검사한다. 데이터 없음, 인증 문제, 호출 제한, 시스템 오류를 별도 AppError로 매핑한다. 공급자 상태코드 숫자는 개발가이드에서 확인해 상수화한다.

프로젝트 기본 예산: 동시 수집 1개, 요청 간 최소 700ms, 실행당 최대 1,000건. 이는 공식 보장 한도가 아니라 프로젝트의 보수적 설정이다. 인증/권한 오류는 재시도하지 않는다. 일시 오류만 횟수 제한과 backoff로 재시도한다. timeout과 취소 기능을 제공한다.

### 5.4 P2-B 로컬 수집과 원문 대조 절차

**상태: 도구 코드 작성, 실행 미검증.** 2026-09-30에 [고유번호][S08], [기업 개황][S09], [공시 검색][S16], [전체 재무제표][S20] 공식 가이드를 다시 확인했다. API 인증·실제 수집·원문 대조는 수행하지 않았다. 기존 fixture 화면을 실제 DART 모드로 전환하지 않았다.

**설정과 범위**

프로젝트 루트에서 Node 24 LTS/npm 11을 사용한다. 본인이 발급한 DART 키는 기존 값을 보존한 `.env.local`의 `DART_API_KEY`에 직접 설정하고 `APP_ENV=local`을 유지한다. 키를 대화나 명령 인자에 넣지 않는다. CLI는 Node의 환경파일 parser로 이 파일을 명시적으로 읽고 프로세스 환경을 우선하되, 어느 쪽이든 public/Vercel/CI이면 실제 실행을 거부한다. 키 발급·계정 생성과 원격 DB 적재는 도구가 수행하지 않는다.

지원 목록의 종목 하나, 사업연도 하나, CFS/OFS 한 기준만 선택한다. 기본 종목은 `005930`, 연도는 실행 연도의 직전 연도, 보고서는 `11014,11011`, 기준은 CFS다. `--reports`는 `11013,11012,11014,11011`의 중복 없는 부분집합이며 Q4 코드를 만들지 않는다. `--until YYYYMMDD`는 정기공시 검색 종료일로 기본값은 실행일(UTC)이다. 재무 API에는 접수일 기준의 과거 시점 조회 인자가 없으므로 `--until`을 재무의 과거 스냅샷 보장으로 해석하지 않는다.

```bash
npm run data:sync -- --symbol 005930 --year 2025 --basis CFS --reports 11014,11011 --run samsung-2025-cfs --dry-run
npm run data:sync -- --symbol 005930 --year 2025 --basis CFS --reports 11014,11011 --run samsung-2025-cfs --max-requests 30
npm run data:sync -- --run samsung-2025-cfs --resume
```

dry-run은 키를 읽거나 네트워크/파일 쓰기를 수행하지 않고 최소 요청 수, 실제 요청 예산과 검색 구간을 출력한다. 실제 호출은 timeout 기본 15초(`--timeout-ms` 1,000~60,000), 최소 간격 700ms, 일시 오류 재시도 최대 2회다. 모든 시도는 호출 **이전**에 누적 횟수로 기록한다. 재개도 동일 예산을 사용하며, 예산 소진 시 `--max-requests`를 명시해 올릴 수 있다(실행 ID당 상한 1,000). 이 숫자를 공식 계정 한도라고 주장하지 않는다.

업무 상태는 `000` 성공, `013` 미제공, `010/011/012/901` 인증·권한, `020` 한도, `800/900` 일시 오류로 구분한다. HTTP 401/403, 429도 각각 인증/한도 오류이며 자동 재시도하지 않는다. HTTP 5xx/통신 timeout만 제한 재시도한다. 그 외 업무 코드·스키마 불일치는 고정된 오류 코드로 중단한다. 원천 오류문/요청 URL/stack/키는 출력하지 않는다.

공시 검색은 사업연도 1월 1일부터 종료일까지 3개월 구간으로 나누고, 정기공시 `A`, `last_reprt_at=N`, 페이지당 100건을 사용한다. 페이지 총수 변화나 중복 접수번호는 조용히 누락하지 않고 중단한다. 이런 경우 새 실행 ID로 재수집한다. API 최신 재무의 접수번호가 수집한 공시 목록에 없으면 후보는 보존하지만 DTO 내보내기를 거부한다.

**저장과 재개**

| 경로 | 내용 |
|---|---|
| `data/raw/dart/<sha256>.bin` | 인증키/요청 URL을 제외한 실제 응답 바이트, 내용별 원본 보존 |
| `data/private/dart/runs/<ID>/state.json` | 계획, 요청 예산/사용량, 성공 작업의 해시·수집일, 실행 상태 |
| 같은 폴더의 `candidate.json` | 회사·공시·재무 행의 수집 후보, source=opendart / unreviewed |
| 같은 폴더의 `review.json` | 원문 대조 기록과 명시적으로 선택한 계정 행 |
| `data/private/dart/exports/<ID>-<reviewHash>.json` | 검토를 통과한 로컬 DTO, reviewed-local / publishedAt=null |

위 경로는 기존 `.gitignore`의 `data/raw/`, `data/private/`에 포함된다. 같은 ID의 새 수집은 기존 상태를 덮어쓰지 않는다. 실패/취소는 `--resume`으로 이어가고, 정정 확인 등 새 수집은 새 ID를 사용한다. 성공한 원본은 재개 때 해시와 스키마를 확인하고 다시 요청하지 않는다. 오류로 거부한 응답은 성공 작업으로 저장하지 않는다. 원본이 손상되면 자동 삭제/덮어쓰기 대신 중단한다.

동시 수집/검토는 `data/private/dart/.sync.lock`으로 막는다. Ctrl+C/SIGTERM은 취소 상태를 저장하고 잠금을 해제한다. 강제 종료로 잠금만 남은 경우 다른 도구 프로세스가 없음을 직접 확인한 뒤 빈 잠금 디렉터리를 제거하고 재개한다. 자동으로 다른 실행의 잠금을 빼앗지 않는다. 아직 장기 재개/동시 실행을 실제 검증하지 않았다.

**원문 대조 기록 작성**

```bash
npm run data:review -- --run samsung-2025-cfs --prepare
# data/private/dart/runs/samsung-2025-cfs/review.json을 원문과 대조해 직접 작성
npm run data:review -- --run samsung-2025-cfs --export
```

양식 생성은 기존 검토 파일을 덮어쓰지 않는다. candidate의 실제 접수번호로 만든 `originalUrl`에서 회사·사업연도·연결/별도·기간·단위를 확인한다. 검토 파일의 `candidateHash`, 보고서의 `payloadHash/receiptNumber/fiscalYear/reportCode/basis`는 그대로 유지한다.

- 최상위: `reviewer`, 수집 이후의 UTC `reviewedAt`, 회사/종목 매핑을 확인한 `companyConfirmed=true`.
- 보고서: `originalChecked/basisConfirmed/periodConfirmed=true`, 원문에서 확인한 `accountingStandard`와 `restatementKey`, 해당 연도의 1월 1일부터 보고 기간 말일까지의 `periodStart/periodEnd`. 같은 restatementKey는 원문으로 비교 가능성을 확인했을 때만 사용한다.
- 각 metric: candidate의 정확한 `rowKey`와 원문 금액을 원 단위 정수 문자열로 기록한 `expectedAmount`, 실제 누적 금액 `expectedYtdAmount`, 원문 표/항목 위치 `tableReference`를 작성한다. 빈 값은 null이고 0은 `"0"`이다. 도구가 원천 금액과 대조한다.
- `amountKind`: BS는 `instant`, 연간 손익/CF는 `annual`, 분·반기 IS/CIS는 `quarter`, 원문에서 누적 의미를 확인한 중간 CF는 `ytd`다. 중간 손익의 expectedYtdAmount는 원천 누적 필드와 일치해야 하고 그 외에는 null이다. 기업 전체 순이익을 선택했을 때만 `profitScope=entity-total`, 다른 metric은 null로 둔다.
- 금액이 없거나 후보가 여러 개라 확정할 수 없으면 `rowKey=null`, `amountKind=unknown`, 금액·profitScope=null과 구체적인 `missingReason`을 남긴다. 계정명만 보고 자동 합산하거나 `owners-of-parent`를 기업 전체 순이익으로 선택하지 않는다.

내보내기는 모든 수집 원본을 다시 읽어 후보를 재구성하고 state/candidate/review 해시를 대조한다. 회사가 12월 결산이 아니거나, 선택 행이 KRW가 아니거나, 접수번호가 목록에 없거나, 목록에 정정 필요/철회 비고(`정`/`철`)가 있으면 내보내지 않는다. 검토 boolean과 해시는 실제 원문을 읽었다는 사실을 독립적으로 증명하지 않으므로 수동 대조가 필수다.

DTO에는 실제 원천 행, 접수번호, 수집일, 선택된 금액의 기간/기준/통화와 mapper version을 담는다. 현재 CLI의 실제 데이터 산출물은 **보고 금액/누적 금액**까지이며 Q4/중간 CF를 단일 분기로 파생하지 않는다. 실제 표본을 확보·검증한 다음 fixture 전용 정규화 경계를 확장한다. 공개 repository/manifest/`data:publish`는 P4로 남기며 export 명령이 공개 사이트를 변경하지 않는다.

## 6. 재무 정규화 규칙

### 6.1 원천과 표시 데이터를 분리한다

원천 필드를 보존하고 별도 mapper로 화면 metric을 만든다. mapper version과 선택 근거를 기록한다.

원천 식별: 접수번호, 사업연도, 보고서 코드, CFS/OFS, 재무제표 구분, 계정 ID, 계정명, 계정 상세, 원문 순서, 원문 payload hash.

`account_id`가 비표준이라고 모두 같은 행으로 합치지 않는다. IS와 CIS에 같은 의미가 겹칠 수 있으므로 항목 수를 단순 합산하지 않는다. 매출/영업이익 매핑은 표준 계정 우선 + 검증된 명칭 allowlist + 회사별 제한적인 보정으로 처리한다. 후보가 여러 개면 ambiguous로 둔다.

### 6.2 연결/별도

CFS 우선 조회는 가능하지만 없다는 이유로 개별 행만 OFS에서 가져오지 않는다. 자동 대체 시에는 보고서 전체 기준이 OFS로 바뀌었음을 명시하고 사용자 필터를 일치시킨다. 비교 화면은 선택한 기준을 유지하고 미제공으로 처리한다.

### 6.3 분기 금액: 최우선 정확성 규칙

공식 전체 재무제표 가이드는 분/반기 IS/CIS의 `thstrm_amount`를 3개월 금액으로, `thstrm_add_amount`를 누적 금액으로 구분한다. 따라서 모든 `thstrm_amount`를 누적이라고 가정해 빼면 잘못된 결과가 나온다. [S20]

| 항목 | 처리 |
|---|---|
| IS/CIS Q1~Q3 | 의미가 확인된 당기 3개월 금액 우선 |
| IS/CIS 누적 | 당기누적 필드를 별도로 저장 |
| Q4 손익 | 비교 가능한 연간 - 3분기 누적으로 파생 |
| 현금흐름표 | 실제 기간 의미를 확인하고 누적이면 이전 누적을 빼서 단일 분기 도출 |
| 재무상태표 | 기말 시점 잔액 그대로, 분기 차감 금지 |

위 계산은 통화, 회계 기준, 연결/별도, 기간, 재작성 기준이 일치할 때만 적용한다. 정정본 차이로 비교 가능성을 확인하지 못하면 계산하지 않는다. 누적이 없는 데이터를 총액으로 추정하지 않는다.

테스트용 합성 숫자 예시:

```text
Q1 누적 100
반기: 3개월 120, 누적 220
3분기: 3개월 140, 누적 360
연간 500

정답: Q1 100, Q2 120, Q3 140, Q4 140
오답: Q2 = 120 - 100 = 20
```

Q4는 `연간-3분기 누적 계산값` 표시를 붙인다. DART에 별도 Q4 보고서가 있는 것처럼 `reprt_code=Q4`를 만들어 요청하지 않는다.

### 6.4 비율

- 영업이익률 = 같은 기간 영업이익 / 매출 × 100. 매출이 0 또는 미제공이면 미계산.
- 연간 성장률은 전년 값이 양수이고 같은 기준일 때 계산한다.
- 전년 적자/0의 이익 변화는 일반 성장률로 보여주지 않고 `흑자전환/적자전환/비교 불가` 등 근거 있는 상태로 처리한다.
- ROE는 후속 기능이다. 분모 평균 자기자본과 분자 이익의 귀속 범위를 맞춰야 한다. 분기 이익에 무조건 4를 곱하지 않는다.
- PER/PBR은 공개 합성 시세와 실제 재무를 혼합하지 않기 위해 MVP에서 제외한다.

### 6.5 정규화 DTO

```ts
export type FinancialMetric = {
  metric: 'revenue' | 'operatingProfit' | 'netProfit'
    | 'assets' | 'liabilities' | 'equity'
    | 'operatingCashFlow' | 'investingCashFlow' | 'financingCashFlow';
  value: string | null; // 원 단위 정수의 십진 문자열
  currency: string;
  basis: 'CFS' | 'OFS';
  periodKind: 'annual' | 'quarter' | 'ytd' | 'instant';
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4 | null;
  periodStart: string | null;
  periodEnd: string;
  source: 'opendart' | 'fixture';
  quality: 'reported' | 'derived' | 'missing' | 'ambiguous';
  profitScope: 'entity-total' | 'owners-of-parent' | null;
  reason: string | null;
  receiptNumbers: string[];
  accountIds: string[];
  mapperVersion: string;
  fetchedAt: string;
};
```

실제 응답에서는 회사 식별자, 계정명, 원문 링크, dataset revision을 포함하는 report envelope 안에 담는다. netProfit은 기업 전체 당기순이익인지 지배주주 귀속인지 정확한 정의를 적고 서로 바꾸지 않는다.

### 6.6 P2-A 예시 구현 경계 (2026-09-30)

- 이번 소스 모델은 `source=fixture`만 허용한다. 회사 `corpCode`, 보고서 `receiptNumber/originalUrl/fetchedAt`는 null이다. 내부 예시 ID와 실제 DART 식별자를 구분하며 source 태그만 바꾸어 실제 원천처럼 처리하지 못하게 한다.
- 원천은 `sj_div`, `account_id/account_nm/account_detail`, `thstrm_amount/thstrm_add_amount`와 rowKey, 통화, 명시적인 기간 해석을 보존한다. 계정 ID `fixture:*`와 예시 명칭 allowlist는 자체 데이터 전용이다. 같은 항목 후보가 여러 개이면 합치거나 임의 선택하지 않고 ambiguous로 둔다. 실제 표준 계정/기업별 명칭 검토는 P2-B에서 한다.
- 금액은 원 단위 정수만 parser에서 받아 쉼표·괄호 음수·음수 부호를 정규화한다. 빈 값/대시/형식 오류는 사유와 null, 숫자 0은 `"0"`으로 구분한다. 연산은 BigInt, JSON/DTO는 문자열이다.
- 선택한 기준의 최신 검토 예시 revision을 사용하며 과거 보고서도 공시 목록에 남긴다. 분기 차감은 회사/연도/통화/회계 기준/CFS·OFS/결산월/재작성 키가 같은 보고서 사이에서만 한다. 서로 다른 정정 비교 기준을 추정하지 않는다.
- 예시 연간은 2023~2025년, 분기 원천은 2025년만 작성했다. 일부 누락·중복·기준 불일치는 의도된 예시이며 실제 회사의 공시 여부를 뜻하지 않는다. Q4 손익·현금흐름은 계산값, Q4 자산·부채·자본은 연말 잔액이다.
- 공식 [전체 재무제표 가이드][S20]와 [공시 검색 가이드][S16]를 2026-09-30에 다시 열어 손익 3개월/누적 필드, 보고서 코드, 정정 표기와 공식 원문 URL 형식을 확인했다. 인증키를 넣은 API 호출이나 실제 원천 수집/대조는 하지 않았다.
- 사용자 지시에 따라 parser/UI의 테스트와 실행 검증은 보류했다. F04/F05/F06 자동화와 기간 라벨 검증을 포함한 P2-A 완료 게이트는 아직 통과한 것으로 기록하지 않는다.

## 7. 저장 모델

아래 모델은 migration 작성 기준이다. 실제 SQL은 P4/P7에서 작성하고 로컬 DB 테스트 후 사용자의 승인 아래 원격 적용한다.

### 7.1 공용 데이터

| 테이블 | 핵심 컬럼 | 제약 |
|---|---|---|
| `companies` | corp_code, name, fiscal_month, corp_class, fetched_at | corp_code PK, 문자열 형식 검사 |
| `instruments` | symbol, corp_code, name, listing_market, is_supported | symbol PK, companies FK |
| `filings` | receipt_no, corp_code, title, filed_date, correction_label, fetched_at | receipt_no PK |
| `financial_reports` | id, corp_code, year, report_code, basis, receipt_no, payload_hash, mapper_version, fetched_at | 버전별 UNIQUE, 정정 보존 |
| `financial_facts` | report_id, row_key, statement, account_id, account_name, detail, raw_amounts | (report_id,row_key) PK |
| `published_datasets` | id, corp_code, dataset_key, revision, source, payload, source_receipts, fetched_at, reviewed_at, published_at, is_published | 공개 DTO만 포함 |
| `sync_runs` | id, started_at, ended_at, status, request_count, error_summary | 키/원문 payload 로그 금지 |

원시 financial_facts와 sync_runs는 비공개 schema 또는 접근 차단 테이블로 둔다. published_datasets의 공개 payload에는 비밀정보, 원본 요청 URL의 인증키, 개인 정보가 없어야 한다. 데이터 제공 모드가 fixture이면 `source=fixture`를 강제한다.

### 7.2 개인 데이터

| 테이블/로컬 store | 핵심 컬럼 | 제약 |
|---|---|---|
| `watchlist_items` | id, user_id, symbol, position, created_at | (user_id,symbol) UNIQUE |
| `research_notes` | id, user_id, symbol, title, thesis, evidence, risks, checklist_json, review, version, created_at, updated_at | title/body 길이 제한, version 증가 |
| `note_revisions` | id, note_id, user_id, version, snapshot, created_at | (note_id,version) UNIQUE, 소유권 일치 |

MVP 게스트 로컬 store는 user_id 대신 기기 내 namespace로 분리한다. 클라우드 동기화를 활성화할 때만 auth.users FK가 생긴다. 로컬 데이터를 공개 Supabase 공용 계정에 저장하지 않는다.

### 7.3 RLS 요구사항

- 공용 테이블은 검토된 published 데이터만 읽게 한다. anon/authenticated 쓰기 차단.
- 개인 테이블은 select/update/delete의 `USING`, insert/update의 `WITH CHECK`에 소유권을 검사한다.
- 기본 조건은 `auth.uid() = user_id`이며 update로 소유권을 다른 사용자로 바꾸지 못하게 한다.
- note_revisions는 note의 소유자와 user_id 일치를 FK/제약/트랜잭션으로 보장한다.
- migration으로 만든 테이블에도 RLS를 명시적으로 켠다.
- 사용자 A/B, 비로그인, 위조 user_id, 다른 note_id로 정책을 테스트한다.
- 개인 쓰기에 Supabase secret/service-role 키를 사용하지 않는다. [S14][S15]

## 8. 우리가 구현할 HTTP API

| 경로 | 용도 | 제한 |
|---|---|---|
| `GET /api/runtime-config` | 안전한 모드/지원 기능 | 비밀정보 반환 금지 |
| `GET /api/instruments?q=...` | 지원 종목 검색 | q 최대 50자, 결과 최대 20개 |
| `GET /api/companies/[corpCode]` | 회사 개황 | 지원 법인만 |
| `GET /api/companies/[corpCode]/financials?year=&report=&basis=` | 보고서 하나의 공개 DTO | 캐시 읽기 전용, 유효 enum |
| `GET /api/companies/[corpCode]/filings?page=` | 공시 목록 | 페이지 크기 고정 20 |
| `POST /api/local/bridge-session` | 로컬 WS 티켓 | 공개 환경 404, origin 검증 |
| `GET /api/local/market/quote?symbol=` | 로컬 초기 시세 | 공개 환경 404, allowlist |
| `GET /api/local/market/candles?symbol=&from=&to=` | 로컬 과거 가격 | 공개 환경 404, 범위 제한 |

재무 overview는 필요한 보고서를 점진적으로 조회하되 동시에 모든 연도를 요청하지 않는다. 비교도 최대 3개 기업만 호출한다. 재무 API가 캐시에 없는 보고서를 요청받으면 즉시 외부 수집을 시작하지 않는다.

응답은 아래 형태를 공유한다.

```ts
export type ApiResult<T> =
  | { ok: true; data: T; meta: {
      source: 'opendart' | 'fixture' | 'synthetic' | 'kis-private';
      fetchedAt: string | null;
      stale: boolean;
      warnings: string[];
    }}
  | { ok: false; error: {
      code: 'INVALID_INPUT' | 'NOT_SUPPORTED' | 'NOT_CONFIGURED'
        | 'NOT_AVAILABLE' | 'RATE_LIMITED' | 'UPSTREAM_ERROR' | 'FORBIDDEN';
      message: string;
      retryable: boolean;
      requestId: string;
    }};
```

브라우저에 공급자 원본 오류, 인증 정보, stack trace를 보내지 않는다. fixture 모드와 dart-cache 모드는 조회 캐시 키에 포함한다. 개인 노트 CRUD는 초기에는 PersonalRepository만 사용하고, 로그인 도입 시 사용자 인증 경로를 별도 추가한다.

## 9. 공개 데이터 출처 manifest

빌드 전에 다음 종류의 manifest를 검사한다.

```json
{
  "schemaVersion": 1,
  "market": {
    "source": "synthetic",
    "generatorVersion": "1.0.0",
    "scenarioId": "balanced-session",
    "seed": "stocklab-v1",
    "containsRecordedKisData": false
  },
  "financials": {
    "source": "fixture",
    "reviewedDatasetIds": [],
    "note": "초기값. 실제 수집과 대조 후에만 opendart로 바꾼다."
  }
}
```

manifest는 자기 선언만으로 라이선스 증명이 되는 것이 아니다. 실제 데이터 생성 경로, 수집 원천, review 기록과 함께 검사한다. 공개 빌드는 한투 키 유무 검사 외에 시세 fixture의 출처도 검사한다.

## 10. 공식 참조와 확인 상태

아래는 문서 작성 시 확인한 공식 근거다. 외부 API 호출 성공이나 실제 계정 한도를 검증했다는 뜻은 아니다. 코드 작성 시 최신 가이드와 샘플 commit을 다시 확인한다.

| ID | 공식 자료 | 용도 |
|---|---|---|
| S01 | [한투 제휴 안내](https://apiportal.koreainvestment.com/provider-info) | 외부 시세 이용 조건 |
| S02 | [한투 공식 샘플 저장소](https://github.com/koreainvestment/open-trading-api) | API 탐색, 참고 구현 |
| S03 | [현재가 공식 예제](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_price/inquire_price.py) | REST 현재가 |
| S04 | [기간별 시세 공식 예제](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_daily_itemchartprice/inquire_daily_itemchartprice.py) | 일봉과 요청 범위 |
| S05 | [OpenDART 소개](https://opendart.fss.or.kr/intro/main.do) | 공시 활용 범위 |
| S06 | [OpenDART 이용약관](https://opendart.fss.or.kr/intro/terms.do) | 인증키, 이용조건, 책임 |
| S07 | [DART 재무정보 활용 안내](https://opendart.fss.or.kr/disclosureinfo/fnltt/dwld/main.do) | 가공/활용과 정확성 한계 |
| S08 | [DART 고유번호 가이드](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018) | 회사/종목 매핑 |
| S09 | [DART 기업 개황 가이드](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002) | 법인구분/결산월 |
| S10 | [Vercel WebSockets](https://vercel.com/docs/functions/websockets) | 현재 호스팅 기능과 연결 수명 |
| S11 | [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation) | 런타임/설치 |
| S12 | [Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs) | 시리즈 업데이트/라이선스 |
| S13 | [Next.js 환경변수](https://nextjs.org/docs/app/guides/environment-variables) | 서버/클라이언트 경계 |
| S14 | [Supabase API 키](https://supabase.com/docs/guides/getting-started/api-keys) | publishable/secret 구분 |
| S15 | [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | 소유권 정책 |
| S16 | [DART 공시 검색](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001) | 목록/접수번호/페이지 |
| S17 | [한투 WS 공식 함수](https://github.com/koreainvestment/open-trading-api/blob/main/examples_user/domestic_stock/domestic_stock_functions_ws.py) | KRX 체결/호가 |
| S18 | [한투 인증/WS 공통 예제](https://github.com/koreainvestment/open-trading-api/blob/main/examples_user/kis_auth.py) | 인증과 수신 처리 |
| S19 | [WS 접속키 예제](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/auth/auth_ws_token/auth_ws_token.py) | approval key |
| S20 | [DART 전체 재무제표](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020) | 보고서/계정/단일 분기와 누적 |
| S21 | [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md/) | 작업 규칙 파일 |

[S01]: https://apiportal.koreainvestment.com/provider-info
[S02]: https://github.com/koreainvestment/open-trading-api
[S03]: https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_price/inquire_price.py
[S04]: https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_daily_itemchartprice/inquire_daily_itemchartprice.py
[S05]: https://opendart.fss.or.kr/intro/main.do
[S06]: https://opendart.fss.or.kr/intro/terms.do
[S07]: https://opendart.fss.or.kr/disclosureinfo/fnltt/dwld/main.do
[S08]: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018
[S09]: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002
[S14]: https://supabase.com/docs/guides/getting-started/api-keys
[S15]: https://supabase.com/docs/guides/database/postgres/row-level-security
[S16]: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001
[S17]: https://github.com/koreainvestment/open-trading-api/blob/main/examples_user/domestic_stock/domestic_stock_functions_ws.py
[S18]: https://github.com/koreainvestment/open-trading-api/blob/main/examples_user/kis_auth.py
[S19]: https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/auth/auth_ws_token/auth_ws_token.py
[S20]: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020
