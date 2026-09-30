# StockLab

키 없이 실행되는 국내 주식 리서치 UI입니다. **P0 / P1-A / P1-B**에 이어 **P2 재무·수집 도구와 P3 관심종목·기업 비교·리서치 노트 코드를 추가했으며, P2/P3 실행 검증은 아직 하지 않았습니다.** 삼성전자·SK하이닉스·NAVER·현대자동차·LG전자 5종목을 탐색합니다. 웹 화면의 시세는 합성이고 재무·공시는 직접 작성한 예시이며, 실제 주가나 기업 실적이 아닙니다.

## 실행

Node 24 LTS (`.nvmrc`: 24.21.0), npm 11을 사용합니다. API 키나 `.env.local`이 필요하지 않습니다.

```bash
npm ci
npm run dev
```

기본 주소는 http://127.0.0.1:3000 입니다. 포트 변경: `npm run dev -- --port 3200`.

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E는 production build를 먼저 만든 뒤 실행합니다. 자체적으로 3100 포트에 `npm run start`를 띄우므로 그 포트는 비어 있어야 합니다. 일반 production 실행은 `npm run build` 후 `npm run start`입니다.

## 현재 기능

- 이름/코드 키보드 검색 → 종목별 상세, 미지원 종목/빈 검색 안내. 홈/상세의 별표로 관심종목 추가·해제.
- 단일 seed와 가상 시계에서 합성 체결 생성 → 검증 → 전체 OHLC/거래량 집계 → 원자적 스냅샷 → 네 영역 렌더링.
- 공유 타이머/가상 시계, 1·2·4배속, 일시정지/재생/전체 초기화. 같은 가상 시간의 체결/집계를 재현하며 초기화는 정지 여부와 배속을 유지합니다.
- 숨긴 탭 자동 정지와 backlog 없는 복귀. 수동 일시정지는 탭 복귀 후에도 유지합니다.
- 상세 URL `period=session|30m|15m`, `tab=overview|orderbook|trades|financials|filings`로 표시 기간/화면을 복원합니다. 표시 기간과 1분 집계 간격은 별개입니다.
- 홈 URL `view=all|watchlist`와 브라우저에 저장한 관심종목을 사용합니다. 이전 `symbols=005930,000660` 링크는 임시 목록으로 표시하며 별도 버튼으로 저장 목록에 추가할 수 있습니다.
- 최근 체결 표시 200개, 내부 버퍼 500개, 캔들 240개 상한. 독립 listener 해제 및 Strict Mode cleanup.
- 차트 대체 수치 표, resize, 모바일 화면, 합성 데이터 설명과 TradingView 고지.
- 재무·공시 탭의 `basis=CFS|OFS`, `view=annual|quarter`, `year=2023|2024|2025` 필터. 예시 연간·단일 분기 재무, 손익 막대 차트, 정확한 원 단위 금액과 산출 근거 펼치기.
- 금액 문자열/BigInt 정규화, 손익 단일 분기와 누적 구분, 비교 가능한 Q4 계산, 누적 현금흐름 차감, 기말 잔액 유지. 미제공·계정 중복·기준 불일치의 사유 표시.
- 공시 정정 예시와 이전 버전 보존. 예시에는 실제 DART 고유번호·접수번호·원문 링크를 부여하지 않습니다.
- `/watchlist`: 관심종목 추가·삭제·순서 변경, IndexedDB 저장. 초기 관심종목은 빈 목록입니다.
- `/compare`: 최대 3개 기업의 같은 연도·연간/분기·연결/별도 기준 비교. 항목별 표·선택형 금액 차트·영업이익률과 미제공 사유를 표시합니다. 비교 대상과 필터는 URL로 복원합니다.
- `/notes`: 제목·종목·핵심 생각·근거·위험·체크리스트·회고, 600ms 자동 저장과 즉시 저장, 검색/삭제/최근 노트. 초안은 화면 이동 뒤에도 유지하고 다른 탭과의 저장 충돌은 최신본/사본 선택으로 처리합니다.
- 저장된 개인 기록의 JSON 내보내기/추가 가져오기/초기화, 미저장 노트의 텍스트 내보내기. 백업은 최대 2MiB, 노트는 최대 200개이며 가져온 노트는 새 ID의 사본으로 추가합니다.

기본 설정은 `synthetic / fixture / local`입니다. 재무의 fixture 모드는 **예시 재무정보 — 실제 기업 실적이 아닙니다** 표시를 유지합니다. 아직 구현하지 않은 다른 모드는 실행을 거부합니다. `APP_ENV=public` 또는 `VERCEL=1`에서 외부 수집 키/한투 브리지 설정을 차단합니다.

## 로컬 DART 수집 도구

`data:sync`는 지원 종목 하나·사업연도 하나·연결/별도 한 기준을 수집합니다. 고유번호 ZIP과 기업 개황, 정기공시 목록, 선택한 전체 재무제표를 로컬에 저장합니다. 실제 키 설정과 수집·원문 대조는 아직 수행하지 않았습니다.

```bash
# 계획만 표시: 키·외부 호출·파일 쓰기 없음
npm run data:sync -- --symbol 005930 --year 2025 --reports 11014,11011 --run samsung-2025-cfs --dry-run

# 로컬 .env.local의 DART_API_KEY 설정 후 실행하는 실제 수집 명령
npm run data:sync -- --symbol 005930 --year 2025 --reports 11014,11011 --run samsung-2025-cfs --max-requests 30

# 실패/중단 시 저장된 범위와 요청 예산으로 이어서 수집
npm run data:sync -- --run samsung-2025-cfs --resume

# 원문 대조 양식 생성 → review.json 직접 작성 → 검토된 로컬 DTO 생성
npm run data:review -- --run samsung-2025-cfs --prepare
npm run data:review -- --run samsung-2025-cfs --export
```

원본은 `data/raw/dart/`, 실행 상태·후보·검토 기록·내보내기는 `data/private/dart/`에 저장되며 모두 Git에서 제외됩니다. 내보내기는 웹 앱의 모드를 바꾸거나 공개 캐시에 배포하지 않습니다. 설정, 재개와 검토 양식 작성법은 [DART 수집 절차](docs/03_DATA_AND_INTEGRATIONS.md#54-p2-b-로컬-수집과-원문-대조-절차)를 참고하세요.

## 범위와 검증

P2-A/P2-B/P3는 사용자 지시에 따라 테스트·린트·타입 검사·빌드·React Doctor·브라우저 검증을 실행하지 않은 상태입니다. DART CLI의 dry-run도 실행하지 않았습니다. 아래 P1-B 결과는 이후 변경의 검증 결과가 아닙니다. 실제 DART 수집과 기업별 계정 매핑/원문 대조, 실제 데이터의 웹 연결은 남아 있습니다.

2026-09-30 P1-B: Node 24.21.0에서 typecheck, lint, unit 44개, Chromium desktop/mobile E2E 10개, build를 실제로 실행했습니다. P0/P1-A의 npm ci 기록은 진행 문서에 보존합니다. 상세 결과/실패 수정/제한/선정 버전은 [진행 기록](docs/05_QUALITY_AND_PROGRESS.md)을 확인하세요.

현재 Next React/접근성 플러그인과의 호환성 때문에 ESLint 9.39.5를 사용합니다. npm의 지원 종료 경고는 남아 있지만 린트는 통과합니다. ESLint 10 전환은 플러그인 지원 확인 후 진행해야 합니다.

KIS/DART/Supabase 실제 연동, 원격 DB 변경, 배포는 수행하지 않았습니다. 개인 저장 코드는 추가했지만 새로고침·다중 탭·용량/권한 오류 상황의 실제 동작은 미검증입니다. 이 브라우저의 데이터를 삭제하면 개인 기록도 사라집니다. 탭을 닫기 전에 ‘저장됨’을 확인하고 필요한 기록은 내보내세요. 로드 후 합성 재생은 offline에서도 가능하지만 최초 offline 접속을 지원하는 PWA는 아닙니다.

차트: [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs), Apache 2.0. 출처와 저작권 고지는 앱의 `/about/data`에 표시합니다.

## Git Flow

`develop`은 통합 브랜치, `main`은 안정 릴리스 브랜치입니다. 사용자 상시 지시에 따라 새 개발 작업은 **최신 develop → 작업 브랜치 생성·전환 → 구현 → 커밋·작업 브랜치 푸시 → develop 병합·푸시** 순서로 마칩니다. 검증 명령은 별도 요청 시에만 실행하고 미검증 상태를 기록합니다. P2-A/P2-B와 P3 코드는 각각의 feature 브랜치에서 develop에 통합했으며 실행 미검증 상태입니다. main 병합·릴리스, PR 생성과 배포는 별도 요청이 필요하며, 일반 작업 PR의 대상은 `develop`, 안정 릴리스는 `develop → main`입니다.
