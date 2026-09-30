# 02. 아키텍처, 실행환경, 보안

문서 버전: 1.0 | 작성 기준: 2026-09-30

## 1. 고정 기술 선택

| 영역 | 선택 | 책임 |
|---|---|---|
| 웹 | Next.js App Router, React, TypeScript strict | 라우팅, 서버 경계, UI |
| 패키지 | npm, 하나의 package-lock.json | 재현 가능한 설치 |
| 스타일 | Tailwind CSS, CSS 변수 | 반응형과 디자인 토큰 |
| 서버 데이터 | TanStack Query | 재무, 공시, 기업정보 요청과 캐싱 |
| 실시간 상태 | Zustand의 세밀한 selector 또는 작은 external store | 종목별 스냅샷과 구독 |
| 검증 | Zod | 환경변수, 외부 응답, 저장 데이터 |
| 폼 | React Hook Form | 노트 입력과 검증 |
| 가격 차트 | TradingView Lightweight Charts | 캔들, 거래량, 점진 업데이트 |
| 재무 차트 | P2-A: HTML/CSS 막대와 수치 표; 상호작용 확장 시 Recharts 검토 | 기간별 손익과 원 단위 근거 |
| 로컬 저장 | IndexedDB, 필요 시 idb | 관심종목, 노트, 버전 |
| 클라우드 | Supabase Postgres/Auth | DART 공개 캐시, 후속 개인 동기화 |
| 로컬 중계 | Node.js, TypeScript, ws | 한투 비밀정보와 WebSocket 관리 |
| 테스트 | Vitest, Testing Library, Playwright | 파서, UI, E2E |
| 공개 호스팅 | Vercel | 웹, 짧은 HTTP 요청, 공개 캐시 읽기 |

처음부터 모든 의존성을 설치하지 않는다. 해당 단계에서 필요해질 때 도입한다. 버전은 P0에서 공식 문서와 패키지 peer dependency를 확인하고 호환되는 안정 버전으로 고정한다. 사용 중인 저장소가 있으면 기존 버전을 먼저 존중한다. Node 버전도 Next.js와 Vercel 양쪽에서 지원하는 LTS로 맞추고 `.nvmrc`, `package.json` engines에 기록한다. 미검증 최신 버전 번호를 문서에서 강제하지 않는다. Next.js 설치 기준은 [S11]을 따른다.

Lightweight Charts는 차트를 그리는 라이브러리이며 시세를 제공하는 API가 아니다. 라이브러리 고지와 TradingView 출처 표시를 공식 요구대로 유지한다. [S12]

## 2. 환경별 구조

### 2.1 초기 개발: 키 없이 실행

```text
Next.js 웹
 ├─ SyntheticMarketProvider → 합성 가격, 호가, 체결, 캔들
 ├─ FixtureFinancialRepository → 예시임을 표시한 재무/공시
 └─ IndexedDB → 방문자 개인 관심종목/노트
```

`npm run dev`로 위 흐름이 동작해야 한다. 외부 API와 DB가 없어도 화면을 개발하고 테스트할 수 있다.

### 2.2 개인 로컬: 실제 한투 시세

```text
브라우저
 ├─ 한투 전용 키 없음
 ├─ 로컬 Next.js에서 단기 접속 티켓 발급
 └─ LocalBridgeMarketProvider
       ↓ 로컬 WebSocket
    127.0.0.1:8787 한투 중계 프로세스
       ├─ REST 초기 가격/과거 일봉 조회
       ├─ 토큰/approval key 관리
       └─ 한투 WebSocket 1개를 공유
```

한투 모드에서는 Next.js도 `--hostname 127.0.0.1`로 실행한다. 로컬 API를 LAN에 노출하거나 공개 터널을 연결하지 않는다.

중계 프로세스는 웹 서버와 분리된 로컬 Node 프로세스다. `.env`와 메모리에서만 한투 키를 다루고 계좌/주문 API를 호출하지 않는다. 실제 연동도 해당 계정의 허용 용도와 조건 안에서만 수행한다. 한투의 외부 시세 제공에는 별도 계약 안내가 있으므로 로컬 구현을 공개 재배포 허가로 해석하지 않는다. [S01][S02]

### 2.3 공개 Vercel: 합성 시세 + 검토된 DART 데이터

```text
브라우저
 ├─ SyntheticMarketProvider → 로컬 가상 시계로 합성 시세 재생
 ├─ Next.js HTTP API → 공개가 검토된 DART 캐시 읽기
 └─ IndexedDB → 방문자 개인 기록

로컬 운영용 data:sync 스크립트
 └─ OpenDART → 검증/정규화 → Supabase 공개 캐시 또는 검토된 스냅샷
```

공개판에는 한투 연결도, 한투 프록시도 없다. 공개판의 시세 재생은 브라우저에서 이루어지므로 시세용 상시 서버를 운영하지 않는다. 브라우저 타이머나 Worker를 사용하는 공개 데모를 실제 WebSocket 통신이라고 설명하지 않는다. 실제 WebSocket 경험은 로컬 한투 연결과 별도의 로컬 스트림 테스트에서 입증한다.

**Vercel에 관한 현재 사실과 설계 선택을 구분한다.** 확인 시점 공식 문서는 Vercel Functions의 WebSocket 지원을 Beta로 안내하며 연결 수명과 외부 상태 저장을 설명한다. 따라서 `Vercel은 WebSocket을 지원하지 않는다`고 문서화하지 않는다. 이 프로젝트에서 공개 중계 서버를 두지 않는 이유는 시세 권한, 키 격리, 비용 및 MVP 복잡도 절감이다. [S10]

## 3. 폴더 구조

다음은 구현 목표 구조다. 문서 패키지에 아래 애플리케이션 코드가 이미 들어 있다는 뜻은 아니다.

```text
AGENTS.md
.env.example
package.json
package-lock.json
src/
  app/
    page.tsx
    stocks/[symbol]/page.tsx
    compare/page.tsx
    watchlist/page.tsx
    notes/page.tsx
    about/data/page.tsx
    api/
  components/
    ui/
    layout/
  features/
    search/
    market/
      providers/
      stores/
      components/
    financials/
    filings/
    compare/
    watchlist/
    notes/
  domain/
    market.ts
    financials.ts
    personal.ts
    schemas/
  server/
    config/
    repositories/
    dart/
    supabase/
  lib/
    formatting/
    dates/
    storage/
  workers/
  data/
    fixtures/
    published/
tools/
  kis-bridge/
    .env.example
    src/
  data-sync/
  checks/
tests/
  unit/
  integration/
  e2e/
supabase/
  migrations/
  tests/
docs/
```

단일 npm 프로젝트로 시작한다. 모노레포, NestJS, Redis, 메시지 큐, Kubernetes를 처음부터 추가하지 않는다. 로컬 중계와 데이터 수집 도구도 같은 lockfile로 관리하고 필요하면 별도 tsconfig로 타입 검사 범위만 구분한다.

## 4. 코드 경계

- `domain/`: 브라우저와 Node가 함께 사용할 순수 타입, 검증, 계산. React와 비밀 환경변수를 import하지 않는다.
- `features/market/providers/`: 공통 인터페이스의 구현. 실제 KIS 프로토콜 파싱은 로컬 중계에 둔다.
- `server/`: 서버 전용 환경변수와 DART 캐시 접근. `server-only` 경계를 사용한다.
- `components/`: 정규화된 DTO만 받는다. `STCK_PRPR`, `thstrm_amount`를 직접 해석하지 않는다.
- `tools/`: 외부 연동, 수집, 데이터 검사. Next.js의 공개 라우트가 자동으로 실행하지 않는다.

추상화는 MarketProvider, FinancialRepository, PersonalRepository 정도만 도입한다. 구현체 하나짜리 추상 팩토리를 과도하게 늘리지 않는다.

## 5. 상태 분리

| 상태 | 보관 장소 | 금지 사항 |
|---|---|---|
| 재무/공시/기업 개황 | TanStack Query | 틱마다 invalidate하지 않는다. |
| 최신 가격/호가 | 종목별 실시간 store | 앱 전체 전역 객체를 매 틱 교체하지 않는다. |
| 전체 수신 체결 집계 | bounded buffer/집계기 | 표에 보이는 샘플만으로 OHLC를 계산하지 않는다. |
| 검색어/탭/비교 대상/기간 | URL | 뒤로가기 시 상태가 사라지지 않게 한다. |
| 모달/입력 포커스 | 로컬 React 상태 | 전역 store에 불필요하게 넣지 않는다. |
| 노트/관심종목 | PersonalRepository | 시장 원본 데이터와 같이 저장하지 않는다. |
| API 키/토큰 | 로컬 중계 또는 서버 환경 | NEXT_PUBLIC, IndexedDB, HTML, 로그에 넣지 않는다. |

## 6. 실시간 파이프라인

```text
수신 → 런타임 검증 → 내부 이벤트 변환 → 집계/상태 계산 → UI 배치 반영
```

### 보존해야 하는 것
- 체결 이벤트는 중복 판단 근거가 명확할 때만 제거한다. 같은 가격, 같은 초, 같은 수량의 별개 체결이 존재할 수 있다.
- 로컬 중계가 부여하는 `sessionId + sequence`는 중계 전달 순서다. 거래소 전체 고유 체결 번호라고 주장하지 않는다.
- OHLC와 거래량은 처리한 모든 유효 체결로 계산한다. 화면 배치 때문에 체결을 임의 샘플링하지 않는다.
- 입력 처리 큐가 상한을 초과하면 overflow/gap을 명시한다. 화면용 버퍼 상한을 이유로 집계할 체결을 조용히 버리고 완전한 집계라고 표시하지 않는다.
- 스냅샷 호가는 가장 최신 완전 스냅샷으로 교체한다. 모든 공급자가 증분(delta) 호가를 준다고 가정하지 않는다.
- 재연결 중 누락된 틱을 복원하지 못하면 `누락 가능 구간`을 표시한다. 누적 거래량 차이만으로 각 분봉 거래량을 추정하지 않는다.

### 초기 UI 정책: 프로젝트 설정값
- 현재가/호가 store 발행: 최대 초당 10회.
- 차트 갱신: 최대 초당 5회, 초기 전체 데이터는 한 번만 설정.
- 체결 표: 최근 200개, 내부 표시 버퍼: 최대 500개.
- 한 번에 구독하는 관심종목: 기본 5개 이내.
- 상세 종목은 체결과 호가, 나머지 관심종목은 체결만 구독한다.

위 수치는 한투 공식 이용 한도가 아니다. 사용성/부하 제어를 위한 보수적인 프로젝트 기본값이다. 측정 후 이유와 함께 변경할 수 있다.

### 연결 상태

`idle → connecting → live → reconnecting → stale/error → live`

`paused`, `market-closed`, `unsupported`를 별도 상태로 표현할 수 있다. WebSocket 연결이 살아 있는 것과 해당 종목에 최근 거래가 있었던 것은 다르다. heartbeat, 마지막 수신 시각, 최근 체결 시각을 분리한다. 거래가 없다는 이유만으로 거래소가 닫혔다고 추정하지 않는다.

재연결은 exponential backoff와 jitter를 사용하고 무한한 빠른 재시도를 막는다. 등록은 `(venue, symbol, channel)`별 ref count로 관리하여 React Strict Mode와 여러 컴포넌트가 구독을 중복 생성하지 않게 한다. 해제 함수와 전체 dispose는 여러 번 호출해도 안전해야 한다.

## 7. 합성 시세와 Replay

기본 구현 이름은 `SyntheticMarketProvider`다. `ReplayProvider`라는 이름을 쓰더라도 원천은 직접 생성한 합성 시나리오로 제한한다. Replay는 전송 방식이 아니라 시간에 따른 재생 방식이다.

- 고정 seed와 가상 session clock으로 같은 입력에 같은 이벤트를 만든다.
- 합성 거래와 호가를 하나의 시장 상태에서 생성한다. 현재가/호가/차트를 서로 무관한 난수로 만들지 않는다.
- 합성 일봉 이력의 마지막 지점과 진행 중 세션의 시작값을 일관되게 만든다.
- 매도 최우선 호가가 매수 최우선 호가보다 낮아지는 비정상 값은 정상 시나리오에서 생성하지 않는다.
- 가격, 수량은 음수가 되지 않도록 한다. 가격 단위 규칙은 합성 엔진의 규칙이라고 명시하고 모든 실제 시장 규정을 재현한다고 주장하지 않는다.
- 같은 화면의 모든 구독자는 같은 session clock을 공유한다. 탭마다 다른 시간이 흐르면 가격이 달라지는 문제를 방지한다.
- 배속은 가상 시간 변화율이다. 이벤트 배열 전체에 setTimeout을 생성하지 않는다.
- 하나의 scheduler와 시간순 큐를 사용하고 pause/resume/reset/dispose를 지원한다.
- 초기화/seek 시 `sessionId`를 바꾸고 차트와 store를 명시적으로 초기화한다.
- 숨긴 탭에서는 가상 시간을 멈춘다. Worker도 terminate 또는 pause 프로토콜로 정리한다.

합성 파일에 `source=synthetic`, `generatorVersion`, `seed`, `generatedAt`, `scenarioId`를 기록한다. 숫자를 실제 거래소에서 복사한 파일에 synthetic 태그만 붙이는 것은 금지한다.

## 8. 재무정보 수집과 공개 캐시

### 수집은 운영 도구, 조회는 공개 API

방문자가 종목 하나를 누를 때마다 10년치 DART를 즉시 호출하지 않는다. MVP는 지원 종목의 필요한 보고서를 로컬 수집 도구로 미리 확보한다.

1. `data:sync`가 서버용 DART 키로 회사/공시/재무 데이터를 수집한다.
2. 파서가 날짜, 금액, 연결/별도, 계정 식별, 중복을 검증한다.
3. 보고서와 대조할 표본 검증 결과 및 수집 이력을 남긴다.
4. 공개 DTO만 published cache로 저장한다.
5. Vercel은 공개 캐시를 읽고 미수집 데이터는 미제공 상태로 보여준다.

DART가 정보를 이용/가공할 수 있게 안내하더라도 결과물의 정확성과 이용자 책임을 함께 명시한다. 출처, 원문 링크, 기준과 수집일을 유지하고 예상실적/유료 리포트로 확대 해석하지 않는다. [S06][S07]

### 캐시 선택

P2 개발: 파일 또는 로컬 저장소 캐시. P4 공개 준비: Supabase의 검토된 공개 DTO 또는 검토된 JSON 스냅샷을 사용한다. 공개 데이터 스냅샷에는 원천, 수집일, 보고서 접수번호, mapper version이 반드시 있다.

Supabase 미설정이면 검토된 스냅샷으로 동일한 조회 인터페이스를 제공할 수 있다. 둘 다 없으면 fixture 모드 또는 미설정 상태이지 실제 DART로 위장한 예시 응답이 아니다.

공개 서버가 캐시 miss를 근거로 자동으로 대량 수집을 시작하지 않는다. 공개 재수집 버튼과 인증 없는 refresh endpoint를 만들지 않는다. 향후 자동 갱신을 도입할 때만 중앙 rate limiter, 중복 작업 잠금, 운영 인증을 추가한다.

### 정정과 오래된 데이터

동일 연도/보고서/기준도 정정될 수 있다. 수집 시 receipt number와 payload hash를 확인하고 기존 버전을 덮어쓰지 않고 새 버전으로 보존한다. `publishedAt`과 `fetchedAt`을 구분한다. 최신이라고 보증할 수 없으면 마지막 수집일과 캐시임을 표시한다.

개인 노트의 응답에는 공유 CDN 캐시를 적용하지 않는다. 공용 DART 캐시와 사용자 캐시를 명확히 분리한다.

## 9. 환경변수 정책

예제 파일은 루트 `.env.example`, `tools/kis-bridge/.env.example`이다. 실제 값은 각 `.env.local`에 넣고 Git에서 제외한다.

| 이름 | 위치/범위 | 의미 |
|---|---|---|
| `APP_ENV` | 서버, local/public | 로컬 전용 기능 허용 여부 |
| `NEXT_PUBLIC_MARKET_MODE` | 브라우저 | synthetic/kis-private |
| `NEXT_PUBLIC_FINANCIAL_MODE` | 브라우저 | fixture/dart-cache |
| `NEXT_PUBLIC_PERSISTENCE_MODE` | 브라우저 | local/supabase |
| `NEXT_PUBLIC_DEMO_SEED` | 브라우저 | 공개해도 되는 합성 재현 seed |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 | 선택적 공개 서비스 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 | RLS 전제의 공개 키 |
| `SUPABASE_SECRET_KEY` | 로컬 수집 도구 우선 | 검토된 공용 캐시 적재용, 브라우저 금지 |
| `DART_API_KEY` | 로컬 수집 도구 | 공시 API 인증키 |
| `KIS_BRIDGE_HTTP_URL` | 로컬 Next 서버 | 로컬 중계의 HTTP 주소 |
| `NEXT_PUBLIC_KIS_BRIDGE_WS_URL` | 개인 로컬 브라우저만 | 공개 빌드에는 비워 둠 |
| `KIS_BRIDGE_SHARED_SECRET` | 로컬 두 프로세스 | Next와 중계 간 내부 인증 |
| `KIS_APP_KEY`, `KIS_APP_SECRET` | 중계의 .env.local만 | 한투 비밀정보 |

`NEXT_PUBLIC_*` 값은 클라이언트 번들에 포함될 수 있다. 서버의 비밀정보를 해당 접두어로 노출하지 않는다. [S13]

Supabase publishable 키는 secret 키와 다르다. secret/service-role 키는 RLS를 우회할 수 있으므로 개인 사용자 요청에 사용하지 않는다. [S14][S15]

### 공개 빌드 fail-closed

`APP_ENV=public` 또는 `VERCEL=1`이면 다음을 검사한다.
- MARKET_MODE는 synthetic이어야 한다.
- 브리지 URL/공유 비밀과 한투 키가 없어야 한다.
- 시장 원본 녹화 파일이 산출물에 없어야 한다.
- 공개 설정 API는 허용된 비민감 필드만 반환한다.
- query/localStorage/UI 토글로 kis-private을 활성화할 수 없어야 한다.

`NODE_ENV === production`만으로 환경을 구분하지 않는다. 로컬 production build와 Vercel Preview의 의미가 다르다. 브라우저 값만 검사하지 말고 빌드와 서버에서도 검사한다.

## 10. 로컬 중계 보안

- listen 주소는 127.0.0.1만 허용한다. 0.0.0.0, 공개 터널, 배포는 금지한다.
- HTTP Host와 WebSocket Origin을 정확한 로컬 허용 목록과 비교한다. 와일드카드 CORS 금지.
- Next의 로컬 전용 `/api/local/bridge-session`이 공유 비밀로 중계의 티켓 발급 API를 호출한다.
- 브라우저는 발급받은 30초 유효 1회용 티켓을 WebSocket 첫 메시지로 전송한다. URL query에 넣거나 저장하지 않는다.
- 중계는 첫 5초 안에 인증하지 않으면 연결을 닫는다. 티켓은 사용 즉시 폐기하고 메모리 저장량을 제한한다.
- HTTP 가격/캔들 요청은 로컬 Next가 공유 비밀 헤더로 중계한다. 브라우저에 장기 공유 비밀을 주지 않는다.
- 모든 요청의 종목과 채널을 allowlist로 검사한다. 사용자가 임의 한투 경로/URL/TR ID를 전송하게 하지 않는다.
- 토큰은 갱신 시 single-flight를 적용하고 payload/헤더 전체를 로그로 남기지 않는다.
- source frame 로깅과 실제 시세 파일 저장은 기본 비활성화다.

정식 원격 서비스 보안 설계를 대체하지 않는 개인 로컬 도구다. 원격화는 별도 데이터 계약과 설계 검토 전에는 금지한다.

## 11. 개인 데이터와 인증

초기 사용자는 브라우저 안에서만 본인 데이터를 저장한다. 다른 방문자와 공유되는 공용 demo user를 만들지 않는다.

후속 Supabase 단계에서만 로그인과 클라우드 저장을 도입한다. 공개 읽기와 개인 데이터 쓰기를 다른 repository로 구분한다. RLS는 사용자 소유권을 검사한다. 클라이언트가 보낸 user_id를 신뢰하거나 secret 키로 개인 쓰기를 처리하지 않는다.

노트 자동 저장은 version을 비교한다. 충돌 시 덮어쓰지 않고 최신본/내 초안 선택을 제공한다. HTML 실행을 허용하지 않는다. 게스트 데이터를 로그인 계정으로 옮길 때는 항목 수와 대상을 확인시키고 명시적인 가져오기 행동으로 처리한다.

## 12. 배포와 비용 원칙

무료 플랜의 한도는 변할 수 있으므로 무제한을 전제로 하지 않는다. 1차 공개 구조는 합성 시세 클라이언트 실행, 정적 자산, 캐시 조회만으로 구성한다. 한투와 DART를 사용자 수만큼 polling하지 않는다.

Preview도 공개 가능 환경으로 취급한다. 운영 데이터와 별도 프로젝트/키를 쓰거나 fixture를 사용한다. 원격 마이그레이션과 Vercel 배포는 사용자 요청을 받은 뒤에만 실행한다. 배포 전 체크는 문서 05를 따른다.

[S01]: https://apiportal.koreainvestment.com/provider-info
[S02]: https://github.com/koreainvestment/open-trading-api
[S06]: https://opendart.fss.or.kr/intro/terms.do
[S07]: https://opendart.fss.or.kr/disclosureinfo/fnltt/dwld/main.do
[S10]: https://vercel.com/docs/functions/websockets
[S11]: https://nextjs.org/docs/app/getting-started/installation
[S12]: https://tradingview.github.io/lightweight-charts/docs
[S13]: https://nextjs.org/docs/app/guides/environment-variables
[S14]: https://supabase.com/docs/guides/getting-started/api-keys
[S15]: https://supabase.com/docs/guides/database/postgres/row-level-security

## P1-B 구현 계약 (2026-09-30)

- Provider 하나에 종목별 엔진 5개와 scheduler 하나를 둔다. 모두 같은 1초 가상 간격으로 진행한다. 삼성전자는 기존 seed, 다른 종목은 `seed:symbol`로 난수를 분리한다. 생성기 버전은 1.1.0이다. 가격 기준값은 자체 합성 상수다.
- 1/2/4배속은 wall tick에서 가상 1초를 1/2/4번 진행한다. 모든 체결을 집계·발행하고 quote/orderbook 스냅샷은 wall tick당 한 번 발행한다. 발행 전에 모든 종목 스냅샷을 완성한다.
- 이벤트 sessionId는 `synthetic:seed:generation:symbol`, sequence는 종목 세션 내부 순번이다. sessionId+sequence가 종목 간 충돌하지 않는다. reset 이벤트와 공유 재생 상태에는 종목 접미사 없는 공유 sessionId를 사용한다.
- 루트 store는 5종목 quote만 구독한다. 행은 종목별 quote, 상세는 종목별 전체 스냅샷, 제어는 공유 상태를 구독한다. 상세 trade/orderbook 구독은 참조 수가 0이면 해제한다. 루트 unmount는 Provider/scheduler/visibility listener를 정리한다.
- 수동 정지와 visibility 정지를 별도로 보관한다. 숨김 중 timer를 제거하고 복귀하면 backlog 없이 이어진다. reset은 모든 종목을 교체하고 정지/배속을 유지한다.
- 차트는 배속 묶음이 분 경계를 넘으면 이전 분 마감값부터 새 분 순서대로 반영한다. 표시 기간 필터는 집계 버퍼를 변경하지 않는다.
- 상세 URL은 `period=session|30m|15m`, `tab=overview|orderbook|trades`. 잘못되거나 중복된 값은 기본값으로 redirect한다. 홈은 `view=all|watchlist`, `symbols`로 목록을 복원하고 미지원/중복 코드는 제외한다. 영구 관심종목/개인 기록 저장은 P3에서 진행한다.

## P2-A 구현 계약 (2026-09-30 · 실행 미검증)

- `domain/financials/`는 예시 회사/보고서 원천 스키마, 금액 parser, 정규화 DTO와 필터를 둔다. 예시 회사 ID는 `fixture-company:<symbol>`이며 실제 8자리 DART corpCode는 `null`이다. 예시 원천의 `fixture:*` 계정 매핑을 실제 기업의 검증된 XBRL 매핑으로 재사용하지 않는다.
- `data/fixtures/financials.ts`의 자체 작성 수치를 `server/repositories/fixture-financial-repository.ts`가 Zod 검증 후 정규화한다. fixture 외 source와 실제 접수번호/원문 URL을 허용하지 않는다. P2-B의 별도 로컬 도구가 실제 DART adapter와 원천 hash/검토 계약을 담당하며 공개 cache는 P4다.
- 재무·공시는 서버 컴포넌트가 조회하여 `StockDetail`의 ReactNode 슬롯에 전달한다. 원천 파일과 repository는 브라우저 import에 포함하지 않는다. 시장 store에서 재무 조회를 호출하거나 시세 틱으로 무효화하지 않는다.
- 재무 자료가 동기적인 로컬 fixture인 이번 단계에서는 별도 HTTP API/TanStack Query/Recharts를 추가하지 않았다. 서버 Suspense/오류 UI, 클라이언트 URL 필터와 정적 HTML/CSS 막대로 범위를 제한한다. 향후 비동기 캐시 조회와 상호작용 요구에 맞춰 해당 의존성을 도입한다. 금액을 Number로 바꾸지 않고 BigInt로 제한된 표시 비율만 계산한다.
- `tab=financials|filings`, `basis=CFS|OFS`, `view=annual|quarter`, `year=2023|2024|2025`를 추가했다. 잘못되거나 중복된 필터는 기본값으로 redirect한다. 미제공인 기준은 그대로 유지하며 다른 기준으로 대체하지 않는다.
- 각 수치의 펼치기에서 정확한 원 금액, 기간, 연결/별도, 예시 원천행과 정정 버전, 계산 사유를 제공한다. 예시 자료의 날짜는 작성일/예시 제출일로 표시하고 실제 수집일과 혼동하지 않는다. 공시는 공식 검색 사이트 링크만 제공하며 가짜 접수번호로 원문을 만들지 않는다.

## P2-B 수집 도구 계약 (2026-09-30 · 실행 미검증)

- `tools/dart/sync.ts`와 `review.ts`는 Node 24가 TypeScript를 직접 읽는 로컬 CLI다. 명시적인 `.ts` import를 위해 `allowImportingTsExtensions`를 사용한다. Next route/브라우저에서 import하지 않으며 웹의 fixture repository는 그대로 유지한다.
- `client.ts`는 고정 DART origin/네 경로, 단일 요청, 700ms 간격, timeout/취소, 업무 상태별 오류, 제한된 일시 오류 재시도를 담당한다. `collect.ts`는 회사·공시 페이지·재무 응답을 검증하고 보고서별 원천 후보를 만든다.
- `store.ts`는 콘텐츠 SHA-256 원본과 실행 상태를 분리한다. 요청 전 예산 사용을 기록하고, 성공한 작업 단위로 체크포인트를 저장한다. 전역 로컬 잠금으로 중복 실행을 막으며 상태 파일은 임시 파일 후 rename한다. 새 실행 ID는 기존 원본과 정정 버전을 보존한다.
- `corporations.ts`는 ZIP에서 경로가 없는 `CORPCODE.xml` 한 항목만 메모리로 읽는다. 압축 응답 20MiB/해제 XML 100MiB, 최대 50만 행, XML DTD·엔티티 처리 차단과 문자열 코드 검증을 둔다. 파서는 CLI 전용 devDependency `fflate 0.8.3`, `fast-xml-parser 5.11.2`이며 둘 다 MIT다.
- `review-model.ts`의 매핑은 원문을 대조한 정확한 원천 행을 보고서 해시에 결합한다. 검토 기록/원본/후보가 맞아야 명시적 DTO를 내보낸다. fixture 계정이나 추정 XBRL 이름을 실제 계정으로 재사용하지 않는다. 해시 검사는 로컬 파일 간 결합을 확인하는 수단이며 공급자의 전자서명이나 수동 검토의 진실성을 증명하지 않는다.
- 현재 실제 DTO는 검토된 보고 금액과 누적 금액을 구분하는 수집 산출물이다. 실제 자료의 Q4/CF 단일 분기 파생과 웹 repository 연결은 실제 원천 검증 이후에 진행한다. 12월 결산·KRW 외의 데이터는 내보내기 지원 범위 밖이다.
- 키/원본 URL/원천 오류를 로그에 출력하지 않는다. `.env.local`은 명시적으로 로딩하고 public/Vercel/CI에서는 실제 도구 실행을 거부한다. 키·원천·검토 산출물·공개 캐시 적재를 Git 커밋이나 자동 배포에 포함하지 않는다.
