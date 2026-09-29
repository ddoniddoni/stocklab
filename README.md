# StockLab

키 없이 실행되는 국내 주식 리서치 UI의 **P0 / P1-A** 구현입니다. 삼성전자(005930) 한 종목을 검색하고 합성 현재가·1분 캔들·10단계 호가·최근 체결을 확인합니다. 모든 시세는 직접 생성하며 실제 현재 주가가 아닙니다.

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

- 이름/코드 키보드 검색 → `/stocks/005930`, 미지원 종목/빈 검색 안내.
- 단일 seed와 가상 시계에서 합성 체결 생성 → 검증 → 전체 OHLC/거래량 집계 → 원자적 스냅샷 → 네 영역 렌더링.
- 일시정지/재생/초기화. 초기화는 새 sessionId, 같은 seed, 같은 초기 가격 흐름이며 정지 여부를 유지합니다.
- 최근 체결 표시 200개, 내부 버퍼 500개, 캔들 240개 상한. 독립 listener 해제 및 Strict Mode cleanup.
- 차트 대체 수치 표, resize, 모바일 화면, 합성 데이터 설명과 TradingView 고지.

기본 설정은 `synthetic / fixture / local`입니다. 아직 구현하지 않은 다른 모드는 실행을 거부하며, fixture 기본값이어도 재무 숫자를 표시하지 않습니다. `APP_ENV=public` 또는 `VERCEL=1`에서 외부 수집 키/한투 브리지 설정을 차단합니다.

## 범위와 검증

2026-09-30: Node 24.21.0에서 npm ci, typecheck, lint, unit 32개, Chromium desktop/mobile E2E 4개, build를 실제로 실행했습니다. 상세 결과/실패 수정/제한/선정 버전은 [진행 기록](docs/05_QUALITY_AND_PROGRESS.md)을 확인하세요.

현재 Next React/접근성 플러그인과의 호환성 때문에 ESLint 9.39.5를 사용합니다. npm의 지원 종료 경고는 남아 있지만 린트는 통과합니다. ESLint 10 전환은 플러그인 지원 확인 후 진행해야 합니다.

다종목, 배속, 숨긴 탭 자동 정지는 P1-B입니다. KIS/DART/Supabase 연동, 관심종목/노트 저장, 원격 DB 변경, 배포는 수행하지 않았습니다. 로드 후 합성 재생은 offline에서도 가능하지만 최초 offline 접속을 지원하는 PWA는 아닙니다.

차트: [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs), Apache 2.0. 출처와 저작권 고지는 앱의 `/about/data`에 표시합니다.

## Git Flow

`develop`은 통합 브랜치, `main`은 안정 릴리스 브랜치입니다. 최초 구현은 `develop`에서 만든 `feature/p0-p1a-synthetic-market`에 커밋합니다. 일반 작업 PR은 `develop`, 안정 릴리스 PR은 `develop → main`으로 진행합니다. Git 변경 작업은 사용자의 명시적인 요청이 있을 때 수행합니다.
