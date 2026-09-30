# 05. 품질 기준, 릴리스 점검, 진행 기록

문서 버전: 1.0 | 초기 상태 기록일: 2026-09-30

이 문서의 목표값과 체크리스트는 앞으로 구현하고 검증할 기준이다. 현재 애플리케이션이 통과한 결과가 아니다. Codex는 작업을 끝낼 때 하단의 실제 진행 기록을 갱신한다.

## 1. Definition of Done

기능 하나가 완료되려면 아래를 모두 만족한다.

- 요구사항에 맞는 실제 동작과 로딩/빈 결과/오류 상태가 있다.
- 데이터 source, 기간, 단위, 연결/별도 기준이 보존된다.
- 키보드와 작은 화면에서 핵심 행동이 가능하다.
- 관련 unit/integration/E2E 테스트가 있고 실행 결과를 확인했다.
- typecheck, lint, build가 통과한다.
- 타이머, 이벤트 listener, 소켓, Worker, 요청의 cleanup을 확인했다.
- 개인 데이터 또는 비밀정보를 로그/URL/공유 캐시에 노출하지 않는다.
- 문서와 구현이 달라졌다면 이유를 기록하고 관련 문서를 함께 수정했다.
- 외부 연동 미실행을 실제 연동 완료처럼 보고하지 않는다.

## 2. 테스트 매트릭스

### 2.1 시세와 재생

| ID | 사례 | 기대 결과 |
|---|---|---|
| M01 | 같은 seed로 두 번 생성 | 같은 가상 이벤트 순서와 값 |
| M02 | pause/resume | pause 중 가상 시간/가격/집계가 멈추고 이어짐 |
| M03 | reset | 새 sessionId, 버퍼/캔들/구독 상태가 깨끗함 |
| M04 | 배속 1/2/4 | 순서가 같고 시간 흐름만 변함 |
| M05 | 화면 왕복/Strict Mode | 중복 타이머와 upstream 구독 없음 |
| M06 | 여러 listener 중 하나 해제 | 다른 listener는 계속 수신 |
| M07 | 숨긴 탭 복귀 | 누적 폭주 없이 이어짐 |
| M08 | 잘못된 틱/미지원 종목 | 스키마 오류 처리, 화면에 NaN/Infinity 없음 |
| M09 | 같은 초/가격/수량의 두 거래 | 근거 없이 하나를 중복 제거하지 않음 |
| M10 | out-of-order 이벤트 | 정의된 정렬/늦은 이벤트 정책 적용 |
| M11 | 대량 입력+UI 배치 | OHLC/거래량이 비배치 기준 집계와 같음 |
| M12 | 재연결 후 누락 | 불확실 구간 표시, 누락 데이터 조작 없음 |
| M13 | 이전 REST 응답 지연 | 더 최신 WS 값을 덮어쓰지 않음 |
| M14 | 호가 스냅샷 교체 | 과거 수량과 중복 합산하지 않음 |
| M15 | synthetic에서 KIS 코드 분기 조작 | 공개 환경에서는 실제 연결이 생성되지 않음 |

### 2.2 재무와 공시

| ID | 사례 | 기대 결과 |
|---|---|---|
| F01 | 빈 값/대시/0 | 미제공과 0이 구분됨 |
| F02 | 큰 금액/괄호 음수/쉼표 | 정밀도 보존, 정확한 문자열/부호 |
| F03 | CFS 없음 | 기준을 몰래 섞지 않음 |
| F04 | 반기 3개월 120, 누적 220 | Q2는 120, 20으로 계산하지 않음 |
| F05 | 연간 500, 9개월 누적 360 | Q4 140, 파생값 표시 |
| F06 | 연간/9개월 기준 불일치 | Q4 계산하지 않음 |
| F07 | CF의 누적 데이터 | 실제 기간 의미 확인 후 분기 도출 |
| F08 | BS 자산/부채 | 기말값 유지, 직전 분기 차감 금지 |
| F09 | 비표준 account_id 여러 행 | 서로 덮어쓰거나 무조건 합치지 않음 |
| F10 | IS/CIS 중복 후보 | 검증된 우선순위 또는 ambiguous 처리 |
| F11 | 연결 전체 순이익/지배주주 순이익 | 다른 항목으로 취급 |
| F12 | 전년 이익 0/적자 | 무의미한 성장률/Infinity 금지 |
| F13 | 8자리/6자리 코드 앞자리 0 | 문자열로 보존 |
| F14 | 정정 보고서 | revision 보존, 최신 검토본 선택 |
| F15 | 미래/미제출 기간 | 없는 실적 생성 금지 |
| F16 | 통화/결산월/기준 다른 기업 비교 | 비교 불가 또는 명시적인 제한 |
| F17 | API 장애/미설정 | 예시를 실제 데이터로 대체하지 않음 |
| F18 | 오래된 published cache | 수집일/오래됨 표시 |
| F19 | fixture 공시 | 예시 표시, 가짜 DART 접수번호 링크 생성 금지 |
| F20 | 합성 가격+실제 재무 | 실제 PER/PBR/수익률을 제공하지 않음 |

F04/F05/F06은 반드시 자동화 테스트로 만든다. 계산 함수 테스트만이 아니라 표/툴팁의 기간 라벨까지 확인한다.

### 2.3 개인 데이터와 접근성

| ID | 사례 | 기대 결과 |
|---|---|---|
| U01 | 관심종목 추가 후 새로고침 | 본인 브라우저에서 복원 |
| U02 | 노트 입력 후 즉시 이동 | flush 또는 이동 경고로 유실 방지 |
| U03 | IndexedDB 실패/용량 문제 | 저장 실패 표시, 텍스트 내보내기 가능 |
| U04 | 여러 탭에서 같은 노트 수정 | 버전 충돌 안내, 조용한 덮어쓰기 금지 |
| U05 | 가져오기 파일 손상/대용량 | 검증 실패, 기존 기록 보존 |
| U06 | 검색 키보드 조작 | 방향키/Enter/Escape, 정확한 포커스 |
| U07 | 실시간 업데이트 | 포커스 이동/스크린리더 반복 폭주 없음 |
| U08 | 모바일/큰 글자 | 페이지 전체 넘침 없이 주요 기능 가능 |
| U09 | 차트 | 텍스트/표 대체 정보, 의미 있는 레이블 |
| U10 | 축소 애니메이션 설정 | 반짝임/전환 제한 |
| U11 | 후속 로그인 A/B | 서로의 노트 조회/수정 불가 |
| U12 | 로그아웃 | 이전 사용자 데이터가 화면/캐시에 남지 않음 |

### 2.4 보안과 배포

| ID | 사례 | 기대 결과 |
|---|---|---|
| S01 | Vercel에서 kis-private 설정 | build/start 단계에서 차단 |
| S02 | 공개 환경의 KIS 키/브리지 비밀 | 설정 검사 실패 |
| S03 | 공개 bundle/정적 파일 검사 | 토큰/실제 시세 녹화 없음 |
| S04 | 공개 사이트 Network 검사 | 한투 및 로컬 브리지 연결 없음 |
| S05 | 공개 재무 cache miss 반복 | 외부 API 호출 폭증 없음 |
| S06 | 공개 origin에서 로컬 WS 접근 | Origin 검사로 거절 |
| S07 | 티켓 재사용/만료/미인증 | 연결 거절/종료 |
| S08 | 임의 URL/TR/종목 요청 | allowlist로 거절 |
| S09 | 원천 오류/로그 검사 | 키, 인증 헤더, stack trace 노출 없음 |
| S10 | RLS 익명 쓰기 | 공용 데이터 변경 불가 |
| S11 | 다른 user_id/note_id 대입 | 개인 소유권 우회 불가 |
| S12 | 개인 응답 공유 캐시 | 다른 사용자에게 재사용되지 않음 |
| S13 | fixture에 opendart 태그만 변경 | manifest/review 검사 실패 |
| S14 | 노트 내 script/HTML | 실행되지 않고 안전한 텍스트로 처리 |
| S15 | 소스/차트 라이선스 고지 | 데이터 설명과 라이브러리 고지 유지 |

참고: 이 절의 S01~S15는 테스트 ID다. 공식 출처 ID는 문서 03의 참조 표에서 구분한다.

## 3. 자동화 환경

일반 CI 테스트는 KIS/DART 실사용 키 없이 수행한다. 외부 호출은 MSW 또는 통제된 테스트 adapter로 대체할 수 있다. 실제 외부 연동 테스트는 별도의 opt-in이며 CI 기본 실행에 포함하지 않는다.

- unit: 숫자 parser, 기간 정규화, 계정 선택, 캔들 집계, 모드 설정, 합성 재생.
- integration: 로컬 중계 모의 upstream, 취소/재연결, repo 계약, 공개 캐시, RLS.
- E2E: 검색 → 상세 → 데모 제어 → 재무 → 비교 → 노트 → 새로고침.
- public smoke: 공개 설정으로 production build를 띄워 실제 브라우저 Network를 검사.

소스 코드에 KIS라는 문자열이 있는지 여부만으로 비밀정보 검사라고 하지 않는다. 환경 값/산출물/요청 경로/데이터 manifest/정적 payload를 함께 확인한다.

## 4. 성능 측정 계획

### 목표와 실측을 구분한다

성능 목표는 개발 목표이며 현재 달성값이 아니다. 서로 다른 장치의 숫자를 직접 비교하지 않는다.

| 실험 | 조건 | 기록할 값 |
|---|---|---|
| 기본 시세 | 5개 종목, 합성 체결 합계 100건/초, 60초 | commit 횟수, main-thread long tasks, 메모리 |
| 높은 입력 | 합성 체결 합계 500/1,000건/초, 각 60초 | 처리량, backlog, 집계 정합성, 입력 지연 |
| 장시간 | 기본 시나리오 30분 | 누수 추세, 버퍼 크기, listener 수 |
| 화면 이동 | 상세↔홈 30회 | 소켓/Worker/타이머 잔존 개수 |
| 많은 행 | 합성 10,000행 데이터 테이블 | 스크롤 반응, virtualization 전후 |

10,000행 실험은 별도 성능 fixture이며 실제 지원 종목이 10,000개라는 뜻이 아니다.

권장 내부 목표: 입력/필터 반응 200ms 이내, 구독 해제 후 잔여 listener 0, 표시 버퍼 상한 유지, 동일 이벤트 집계 결과 일치. 지표의 측정 방식과 테스트 장비를 기록한다. Lighthouse 점수 하나만으로 고빈도 스트림 성능을 입증하지 않는다.

### 측정 템플릿

```text
실험 ID:
코드 commit 또는 작업 상태:
날짜 / OS / 브라우저 버전 / 장비:
입력 시나리오 / seed / events per second:
지속 시간 / 반복 횟수:
측정 도구:
변경 전 결과:
변경 후 결과:
집계 결과 동일 여부:
한계 / 재현 절차:
```

Worker를 도입했다는 사실만으로 최적화되었다고 결론 내리지 않는다. serialization과 main-thread 업데이트 비용까지 측정한다. 실제 개선이 없으면 복잡한 구조를 제거하거나 목적을 다시 정의한다.

### P6-B 합성 엔진 측정 도구 계약

2026-09-30 작성, **도구 자체와 모든 측정은 미실행**. 위 계획 중 합성 엔진 처리와 정합성 측정용 CLI만 준비했다. React commit/long task/입력 지연, 실제 앱 구독·페이지 이동과 브라우저 메모리는 후속 계측 범위다.

- 실행 진입점은 `npm run test:perf -- ...`이며 `.nvmrc`의 Node 24를 사용한다. 기본값은 100/500/1000 각각 60초 1회다. `--rates`는 이 세 값 중 중복 없는 목록, `--seconds`는 1~1800, `--repeats`는 1~5이고 전체 예정 시간은 1800초 이하로 제한한다. 사후 대조와 최대 5초의 잔여 처리 시간은 별도로 추가된다.
- `--seed`와 `--run`은 영문·숫자·하이픈·밑줄 1~64자이며 첫 글자는 영문/숫자다. 기본 seed는 `stocklab-perf-v1`, 실행 ID는 매번 새로 생성한다. `--label`은 장비/실행 조건을 남기는 100자 이하의 한 줄 메모다. `--help`도 이번 개발에서는 실행하지 않았다.
- 입력 단위는 **5종목 합계 체결/초**다. 기존 명세의 events/s를 이 CLI에서는 입력 체결로 구체화했다. 한 체결당 quote와 book도 한 개씩 생성하므로 세 payload를 모두 세는 값과 다르다. 1000 체결/초는 종목별 200 체결/초이며 실제 한투 관측치가 아니다.
- 고정 순서로 한 종목씩 입력한다. 종목별 가상 시간 간격은 `1000 × 5 / rate`ms이고 receipt 시각도 가상 시각으로 고정한다. 다른 rate에서는 RNG 순서는 같아도 캔들 시간과 집계가 달라지므로 최종 해시는 같은 rate/seed/처리 건수끼리 비교한다.
- 측정은 `SyntheticEngine`의 생성·Zod 검증·전체 캔들 집계와 계측 스케줄러를 포함한다. 앱의 Provider/store/구독/React 렌더링·외부 API를 실행하지 않는다. 초기 160체결×5종목의 합성 이력 생성 시간은 별도 `initializationMs`에 기록하고 본 측정에서 제외한다.
- 스케줄러는 monotonic 시각으로 도착 예정 건수를 계산하고 최대 100건/5ms씩 처리한다. 정상 대기는 10ms, 대기가 남으면 1ms 후 이어서 처리한다. 밀린 체결은 건수로만 보관하고 건너뛰지 않는다. 실행 시간 뒤 최대 5초까지 처리하며 남으면 `deadline`으로 기록한다. 5ms는 입력 사이의 양보 기준이며 단일 연산을 선점하는 보장은 아니다.

| 보고서 필드 | 뜻과 한계 |
|---|---|
| `processedTrades / plannedTrades` | 실제 생성·집계한 입력 수 / 전체 예정 입력 수. 초기 이력 제외 |
| `processedWithinWindow` | 설정 시간 안에 완료한 체결 수. 이후 잔여 처리와 구분 |
| `pendingTrades / notYetDueTrades` | 종료 시 도착 예정 시각이 지난 미처리 입력 / 아직 시각이 오지 않은 입력 |
| `maxPendingTrades` | 스케줄러가 관찰한 최대 미처리 예정 입력 수. 실제 소켓 큐 크기가 아님 |
| `observedTradesPerSecond` | 처리 건수 / 잔여 처리 포함 실제 경과 시간. 최대 처리 능력 추정치가 아님 |
| `scheduledCompletionLagMs` | 예정 입력 시각부터 생성·집계 완료까지의 히스토그램. UI 입력 지연이 아님 |
| `eventLoopDelayMs / eventLoopUtilization` | 10ms 해상도 Node monitor의 원래 지연 분포와 utilization. 브라우저 long task로 환산하지 않음 |
| `cpuMs / batchWorkMs` | 측정 구간의 전체 프로세스 user/system CPU 시간 / 배치 처리·계측 시간 |
| `memoryBytes.samples` | 시작·약 1초 간격·종료의 RSS/heap/external/ArrayBuffer bytes와 진행 상태. 순간 peak/누수 판정이 아님 |
| `buffers` | 모든 입력 후 관찰한 종목별 체결/캔들 버퍼 최댓값과 500/240 상한 위반 여부 |
| `integrity` | 측정 밖의 동일 입력 재생 SHA-256과 별도 OHLC/BigInt 누적 집계·최종 가격 대조. 초기 이력 자체는 동일 기준에서 시작 |
| `browser` | `measured: false`, commit/long task/input latency는 `null`. 0이나 통과로 표시하지 않음 |

- 보고서는 Git 제외 `test-results/performance/<실행 ID>/report.json`과 `report.md`다. 원시 체결을 파일로 저장하지 않는다. 실행 ID 폴더는 독점 생성하고 기존 파일을 덮어쓰지 않는다. 시작·각 사례 종료·최종 종료에 저장하며 JSON을 기준으로 읽는다. 각 파일은 임시 파일 후 rename하므로 강제 종료 때 Markdown만 이전 버전일 수 있다.
- Ctrl+C/SIGTERM은 대기와 사후 대조를 취소하고 측정 중간 결과를 기록한다. 모든 사례 완료 및 정합성/상한 만족은 exit 0, 실패/시간 초과/불일치는 1, SIGINT는 130, SIGTERM은 143이다. OS 강제 종료나 쓰기 실패의 부분 저장을 보장하지 않는다. `running` 또는 사례 수 부족은 완료 보고서가 아니다.
- 각 반복은 같은 프로세스에서 순차 실행하며 JIT/GC·이전 보고서 보관·계측 비용이 섞인다. CPU/OS/Node/코드 SHA/dirty/label을 함께 기록하고, 동일 장비·seed·rate·기간·반복/실행 조건으로만 전후를 비교한다. `completed`/`matched`는 이 도구의 실행/대조 상태이며 목표 성능이나 릴리스 통과 상태가 아니다.
- 키·환경파일·외부 API·사용자 DB를 사용하지 않으며 build/start/CI에서 자동 실행하지 않는다. 새 의존성이나 Worker/가상화를 추가하지 않았다. `verify` 진입점과 브라우저 계측은 아직 미구현이다.
- 공식 근거(2026-09-30): [Node 24 성능 API](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html), [메모리 측정](https://nodejs.org/docs/latest-v24.x/api/process.html#processmemoryusage), [TypeScript 실행 제약](https://nodejs.org/docs/latest-v24.x/api/typescript.html). 문서 열람은 실행 검증이 아니다.

## 5. 공개 릴리스 체크리스트

### 5.1 설정

Vercel Preview/Production의 기본값:

```text
APP_ENV=public
NEXT_PUBLIC_MARKET_MODE=synthetic
NEXT_PUBLIC_FINANCIAL_MODE=dart-cache
NEXT_PUBLIC_PERSISTENCE_MODE=local
NEXT_PUBLIC_SITE_URL=<실제 배포 URL>
NEXT_PUBLIC_DEMO_SEED=stocklab-v1
```

`dart-cache`는 실제 검토된 데이터를 준비한 경우에만 설정한다. 준비하지 못한 초기 Preview는 fixture로 두고 예시 표시를 유지한다. 실제 재무가 있는 최종 포트폴리오라고 설명하려면 DART 캐시와 대조 기록이 있어야 한다.

선택: 공개 캐시를 Supabase에서 읽는 경우 URL과 publishable 키만 설정한다. 검토된 정적 스냅샷 방식이면 이 설정도 없어도 된다.

**공개 환경에 넣지 않는 값:** KIS_APP_KEY, KIS_APP_SECRET, KIS_BRIDGE_SHARED_SECRET, 브리지 HTTP/WS URL, DART_API_KEY, 로컬 수집용 SUPABASE_SECRET_KEY. 향후 서버 관리자 기능에 secret 키가 필요해져도 사용자 요청과 별도 보안 검토 전에는 추가하지 않는다.

### 5.2 데이터

- [ ] 시세/호가/체결/과거 캔들이 모두 자체 생성한 데이터다.
- [ ] 실제 한투 응답, 녹화, 이미지, 캡처, DB dump가 빌드에 없다.
- [ ] 가격 가까이에 시뮬레이션 표시가 있고 모바일에서도 잘린 채 숨지 않는다.
- [ ] DART 출처, 사업연도/분기, CFS/OFS, 수집일, 원문이 있다.
- [ ] 파생 분기와 누적 수치가 구별된다.
- [ ] 정정 이력/원천 버전/mapper version을 추적할 수 있다.
- [ ] 미제공을 0으로 채우지 않는다.
- [ ] 합성 시세와 실제 재무를 계산에 섞지 않는다.
- [ ] fixture 공시가 진짜 DART 접수번호처럼 보이지 않는다.

### 5.3 보안과 운영

- [ ] 공개 빌드/실행에서 한투 모드를 차단한다.
- [ ] 브라우저와 public 파일에 비밀 값이 없다.
- [ ] raw 금융 데이터 테이블과 수집 로그는 외부 쓰기/읽기가 차단되어 있다.
- [ ] 공개 projection을 view로 만들었다면 view 권한/RLS 우회 여부까지 확인했다.
- [ ] 공개 재무 API는 캐시만 읽고 원격 수집을 시작하지 않는다.
- [ ] 개인 노트가 사용자 간 공유되지 않는다.
- [ ] 소스/라이브러리 출처 고지가 있다.
- [ ] 수집이 오래되면 마지막 수집일이 표시된다.
- [ ] rate/cost 알림과 서비스 플랜 한도를 실제 계정에서 확인했다.
- [ ] Vercel Preview URL에서 먼저 검증했다.

### 5.4 검색과 포트폴리오 표시

합성 가격이 실제 주가로 검색에 노출되지 않도록 공개 데모 전체에 noindex 메타데이터를 기본 적용한다. robots 설정은 정보 접근 통제 수단이 아니므로 실제/비밀 데이터의 유출 방지 대신 사용할 수 없다.

Open Graph와 README 캡처에도 시뮬레이션 여부를 표시한다. `실제 현재 주가 서비스`, `실제 수익률 검증`, `투자 정확도` 등의 문구를 사용하지 않는다.

## 6. 이력서/README에 기록할 근거

실제 구현과 검증 상태에 맞는 문장만 사용한다.

```text
개인 로컬 환경에서 한국투자 Open API WebSocket의 체결/호가를 수신하고,
공개 데모에서는 동일한 인터페이스의 합성 시세 공급기를 사용하도록 분리했다.
```

이 문장은 실제 한투 수신 검증까지 완료했을 때 쓴다. 미완료이면 `실시간 시세 연동용 인터페이스와 합성 스트림 기반 UI를 구현했다`처럼 범위를 줄인다.

```text
OpenDART 재무정보의 연결/별도와 단일 분기/누적 금액을 구분해 정규화하고,
공시 원문과 데이터 출처를 추적할 수 있는 재무 비교 화면을 구현했다.
```

```text
합성 부하 N events/s, 지정 장비/브라우저에서 측정한 결과,
[측정 항목]을 [변경 전]에서 [변경 후]로 개선했다.
```

대괄호와 N은 실측 전에는 채우지 않는다. 합성 부하 결과를 실제 거래소 처리량으로 바꾸어 말하지 않는다. 브라우저 내 재생을 WebSocket 서버 구축이라고 쓰지 않는다.

## 7. 현재 진행 상태

### 7.1 현재 상태

| 항목 | 상태 |
|---|---|
| 개발 문서 | 작성됨 |
| Next.js 앱 | P0/P1 검증 기록 보존. P2 재무·수집/P3 개인 리서치/P4 공개 캐시·조회 API/P5 로컬 한투/P6-A 시세 읽기 코드, 실행 미검증 |
| 패키지 버전/Node 버전 선정 | Node 24.21.0 LTS / npm 11.17.0, 아래 작업 기록 참조 |
| 합성 시세 Provider | 5종목, 공유 시계/배속/숨김 정지/전체 초기화/URL 복원 |
| 시세 읽기 | P6-A 화면 고정·한 번 반영·자동 갱신 복귀, 전체 캔들 수치표 코드 작성. 실행/접근성 미검증 |
| 합성 부하 측정 도구 | P6-B test:perf CLI·Node 지표/정합성·보고서 코드 작성. 도움말/측정/대조 실행 0회, 측정값 없음 |
| 실제 한투 키 발급/인증/수신 | P5 브리지·조회/수신/UI 코드 작성. 실제 키 확인·인증·시세 호출·수신 미실행 |
| DART 키/실제 수집/원문 대조 | P2-B 로컬 수집/검토 도구 코드 작성. 키 준비 상태 미확인, 실제 수집·원문 대조 미실행 |
| Supabase 생성/migration/RLS | P4 migration SQL 파일 작성. 프로젝트 생성·로컬/원격 적용·RLS 실행 검증 미실행 |
| 공개 재무 자료 | manifest는 fixture/빈 목록. 실제 공개 DTO 생성·등록·DB 적재 0건 |
| 테스트/lint/typecheck/build | P1-B 당시 unit 44개/E2E 10개 및 기본 검사 통과. P2-A/P2-B/P3/P4/P5/P6-A/P6-B는 사용자 지시로 전부 미실행 |
| Vercel 배포 | 미실행 |
| Git Flow | P0~P5/P6-A/P6-B 코드는 develop에 통합. P2~P6-B는 실행 미검증 유지. main 릴리스 미실행 |

### 7.2 단계 기록

| 단계 | 상태 | 완료 근거 | 남은 일 |
|---|---|---|---|
| P0 | done | 키 없는 npm ci/dev/typecheck/lint/unit/build 검증 | ESLint 9 호환성 제한 추적 |
| P1 | done | P1-A / P1-B 완료 및 로컬 검증 | 장시간/다중 브라우저 측정은 P6 |
| P1-A | done | 홈 검색 → 상세, 단일 합성 파이프라인, unit/E2E/브라우저 확인 | 없음 |
| P1-B | done | 5종목/선택 목록/공유 배속/visibility/URL, unit/E2E/시각 확인 | 실제 OS 백그라운드 동작 미검증 |
| P2 | in_progress | P2-A 예시 재무·공시와 P2-B 수집/원문 검토 도구 코드 추가 | 두 단계 실행 검증, 실제 수집·대조와 실제 데이터의 분기 파생/웹 연결 |
| P2-A | implemented_unverified | 코드 작성 및 원천 의미의 공식 가이드 참고 | F04/F05/F06을 포함한 자동화 작성/실행, 기본 검사와 UI 확인은 사용자 요청 대기 |
| P2-B | implemented_unverified | data:sync/data:review, 원천 해시와 체크포인트, 검토된 로컬 DTO 코드 | CLI/의존성 검증, 키 설정·회사 한 곳의 실제 수집/계정 선택/원문 대조. 키 없음이 확인되면 실제 수집 blocked 기록 |
| P3 | implemented_unverified | IndexedDB 관심종목/노트, fixture 기업 비교, 충돌·백업·초안 처리 코드 | U01~U10/F16, 기본 검사/UI/다중 탭/저장소 장애 검증과 기존 URL 선택 E2E 갱신 |
| P4 | implemented_unverified | 검토 DTO/JSON·Supabase 조회/GET API/SQL·공개 설정과 빌드 검사 코드 | 실제 공개 자료, DB 적용/RLS, API miss·입력 제한, 빌드/trace/Network 검증 |
| P5 | implemented_unverified | 개인 로컬 브리지·티켓/REST API·KRX 파서·공유 구독·현재가/체결/호가/일봉 UI 코드 | 실제 인증/수신, 계정 한도·교차/빈 호가 대조, 경합/cleanup/다중 탭/공개 차단 검증 |
| P6 | in_progress | P6-A 접근성 기능, P6-B Node 합성 부하 측정 도구 코드 작성 | 브라우저 계측/verify 진입점, 실행·측정/접근성 검증과 릴리스 게이트 |
| P6-A | implemented_unverified | 시세 표시 고정/한 번 반영/자동 복귀, 전체 캔들 수치표 코드 | 표시/수신 분리, 라우트/visibility/cleanup, 모바일/키보드/보조공학 확인 |
| P6-B | implemented_unverified | test:perf 입력 시나리오·Node 지표·사후 집계 대조·JSON/Markdown 보고서 | Node 24 CLI/취소·기한·정합성/보고서, 웹 호환/공개 추적과 실제 측정 검증 |
| P7 | not_started | 선택 | 클라우드 개인 동기화 |

### 7.3 확정 설계 결정

| ID | 결정 | 이유 |
|---|---|---|
| ADR-01 | 한투는 로컬 전용 | 개인 키 보호와 공개 시세 권한 분리 |
| ADR-02 | 공개 시세는 합성 | 실제 녹화 재배포에 의존하지 않음 |
| ADR-03 | DART 사전 수집+공개 캐시 | 요청량, 장애, 출처/정확성 통제 |
| ADR-04 | 초기 개인 기록은 로컬 | 로그인 장벽 없이 포트폴리오 체험 |
| ADR-05 | 실제 주문/컨센서스 제외 | 범위와 데이터 책임 통제 |
| ADR-06 | 원천/정규화/표시 분리 | 재무 오류와 공급자 종속 방지 |
| ADR-07 | npm 단일 프로젝트 | 도구/서버 구조의 불필요한 복잡도 축소 |
| ADR-08 | P1-A는 삼성전자 1종목/합성 1분 세션만 | 일봉, 다종목, 배속은 확장하지 않고 시간대가 있는 1분 이력 계약을 검증 |
| ADR-09 | 작은 external store + useSyncExternalStore | 원자적 스냅샷으로 네 영역을 함께 갱신, 루트 세션은 페이지 이동 간 유지 |
| ADR-10 | 미구현 모드를 설정하면 명시적으로 실패 | synthetic/fixture/local만 실행. fixture 모드라도 이 단계에 재무 숫자를 만들지 않음 |
| ADR-11 | ESLint 9.39.5 고정 | 설치된 Next React/접근성 플러그인의 peer 범위가 ESLint 9까지. 10은 실제 실행 실패 |
| ADR-12 | P1-B 선택 목록은 URL, 영구 저장은 P3 | 관심종목용 quote와 빈 목록부터 검증하고 개인 저장 범위 유지 |
| ADR-13 | 같은 1초 이벤트를 wall tick당 1/2/4회 생성 | 배속이 RNG 순서/체결/집계를 바꾸지 않고 UI는 묶어서 갱신 |
| ADR-14 | P2-A source는 fixture 전용, 실제 corpCode/접수번호/원문/수집일은 null | 예시를 실제 기업 공시로 오인하거나 태그만 바꾸어 실제 데이터로 처리하는 경로 방지 |
| ADR-15 | 예시 재무는 서버 repository + ReactNode 슬롯 + HTML/CSS 막대 | 시세 store와 수명/갱신 분리, 로컬 fixture 단계에 HTTP/차트 의존성 추가를 보류 |
| ADR-16 | 사용자 명시 요청 전 검증 명령 미실행 | 최신 사용자 지시 우선. P2-A는 코드 작성 후에도 done으로 표시하지 않음 |
| ADR-17 | 개발 요청 시 브랜치 생성부터 커밋·작업 브랜치 푸시·develop 병합/푸시까지 수행 | 최신 사용자 상시 지시. 검증 명령은 별도 요청 시에만 실행하고 main 릴리스/배포 등은 별도 권한 유지 |
| ADR-18 | 실제 DART 매핑은 보고서 해시에 결합된 수동 행 선택부터 시작 | 실제 응답을 보지 않고 XBRL ID/계정명 우선순위를 추정하지 않음. fixture 계약은 별도로 유지 |
| ADR-19 | P2-B export는 Git 제외 로컬 DTO이며 실제 분기 파생/웹 cache는 후속 | 원문·기간 대조 전 실제 실적 화면을 제공하지 않음. 공개 적재는 P4의 별도 동작 |
| ADR-20 | 개인 문서 하나를 IndexedDB readwrite 트랜잭션으로 읽고 비교·저장 | 작은 게스트 데이터의 노트별 version/관심목록 version/전체 revision 검사를 원자적으로 처리 |
| ADR-21 | 노트 초안은 루트 세션에 보존하고 저장 완료 전 탭 종료 안내 | 라우트 이동 뒤 오류·충돌이 발생해도 텍스트 내보내기/사본 저장 가능. 강제 종료 무손실을 보증하지 않음 |
| ADR-22 | 이전 symbols URL은 임시 목록, 비교는 서버 fixture 조회 | URL로 개인 목록을 몰래 덮어쓰지 않음. 실제 수집 없이 실제 비교 결과로 표시하지 않음 |
| ADR-23 | P3 폼/저장은 native API와 기존 Zod로 구현 | 작은 텍스트 폼과 명시적 transaction 범위, 추가 의존성 없이 기존 React/UI 구조에 통합 |
| ADR-24 | 공개 재무는 manifest의 고정 ID/canonical SHA-256을 JSON·Supabase에서 동일하게 확인 | 원천·검토 기록과 공개 DTO 구분, 미등록/바뀐 payload 거부, 정정 revision 보존 |
| ADR-25 | Supabase는 publishable 키로만 읽고 실패 시 다른 자료로 대체하지 않음 | 웹에서 운영 키/RLS 우회/비공개 원본 접근 차단, 명확한 오류 상태 |
| ADR-26 | 실제 Q4 손익·분기 CF 파생을 P4에서 보류하고 원천 누적을 표시 | P2 실제 표본/검증이 남아 있어 예시 계산기의 실제 데이터 재사용을 피함 |
| ADR-27 | 공개 API/remote fetch는 no-store, 공시는 한 페이지 5개 묶음·최대 20개 | 철회 후 오래된 성공 응답 재사용 방지와 요청 크기/범위 제한 |
| ADR-28 | Next 배포 추적에서 private/원천/운영 도구 제외, npm build/start에 공개 검사 연결 | source manifest와 설정·산출물 경계를 코드화. 실제 보안 검증과 배포 승인을 대신하지 않음 |
| ADR-29 | P5는 real/KRX/고정 loopback 포트/개발 서버만 지원 | 동적 주소·시장 혼합·공개 실행 범위를 제한하고 bridge 자식에만 한투 키를 둠 |
| ADR-30 | 실제 시세는 null 초기값·별도 store·메모리만, 상세 재진입/재연결마다 새 관측 구간 | 합성 값 혼입과 누락 체결을 완전한 시계열처럼 표시하는 문제 방지 |
| ADR-31 | 일봉은 원주가/90일 구간 요청/최대 날짜 차이 366일/partial 표시 | 100건 한도와 달력 미대조를 보존, 실제 분봉과 병합하지 않음 |
| ADR-32 | 화면 고정은 원천 수신/집계와 분리하고 현재 탭의 bounded snapshot 한 벌만 보관 | 읽는 동안 숫자/목록/상태를 유지하고 고정 시각을 명시. 자동 복귀는 현재 값으로 이동하며 저장/재배포하지 않음 |
| ADR-33 | 전체 캔들 수치표는 화면 고정 상태에서 최신순 20행씩 제공 | 값/행이 바뀌지 않는 텍스트 대체 정보. 실제 table/caption/행·열 header를 사용하며 틱마다 읽기 알림을 추가하지 않음 |
| ADR-34 | P6-B는 기존 엔진을 직접 구동하는 opt-in Node CLI, 입력 단위는 5종목 합계 체결/초 | 실제 한투/앱 Provider/브라우저 성능과 측정 범위를 혼동하지 않음. 브라우저 지표는 null 유지 |
| ADR-35 | 사후 재생/독립 집계 대조와 보고서 쓰기는 본 측정 구간 밖 | 처리량에 대조 비용을 섞지 않고 종료/취소/시간 초과/미측정을 보고서에 구분 |

### 7.4 검증이 필요한 외부 항목

- 본인 한투 계정의 신청 조건과 허용 사용 목적
- 본인 계정의 최신 REST/WS 한도와 토큰 정책
- 실제 수신 프레임의 필드와 공식 샘플 commit SHA
- DART 인증키와 실제 지원 기업의 원문 대조
- Vercel/Supabase 실제 플랜과 사용량/권한 설정
- 후속 도입 라이브러리의 버전/라이선스와 ESLint 10 호환 플러그인

위 항목이 미확인이라고 전체 개발을 멈추지는 않는다. 키 없는 합성 UI, parser 테스트, 공개 차단 로직을 먼저 만들고 해당 연동만 미검증 상태로 남긴다.

## 8. 작업 종료 기록

### 2026-09-30 · P6-B 합성 시세 부하 측정 CLI (실행 미검증)

**범위와 Git Flow**

- 깨끗한 `develop` / `a1975a4`에서 origin fetch 후 차이 0을 확인하고 편집 전에 `feature/p6-synthetic-performance-runner`를 생성했다. 상시 지시에 따라 관련 파일 커밋·작업 브랜치 푸시·develop 병합/푸시까지 수행한다.
- 기능 커밋 `05920f9`를 `origin/feature/p6-synthetic-performance-runner`에 푸시했다. 다시 fetch하고 develop 차이 0을 확인한 뒤 `--no-ff`로 충돌 없이 병합했다. 이 통합 커밋에 README와 현재 Git 상태 기록을 포함하며 실행 미검증 상태를 유지한다.
- 다음 기능은 앞서 예고한 P6 측정 도구 작성으로 제한했다. 기존 검증 금지 지시는 유지하며 CLI/정합성 코드 작성과 실행을 구분한다. P6 전체는 in_progress, P6-B는 implemented_unverified다.

**작성한 내용**

- `tools/perf/options.ts`/`scenario.ts`: 100/500/1000 체결/초·5종목·seed 기반 결정론적 입력, 시간/반복/ID 인자 제한, 별도 측정 스케줄러, bounded 엔진 상태.
- `measure.ts`: 예정 건수/처리 건수/미처리와 미도착 구분, 실제 경과 처리량·완료 지연 히스토그램·Node 루프/CPU·메모리 표본·버퍼 상한. 취소 가능한 대기와 최대 5초 잔여 처리, monitor 정리 경로.
- `audit.ts`: 측정이 끝난 뒤 같은 입력을 재생한 상태 해시와 별도 mutable OHLC/BigInt 누적 거래량·최종 가격 대조. 초기 이력은 독립 검증하지 않으며 알고리즘/앱 전체 검증을 주장하지 않는다.
- `report.ts`/`run.ts`: Node 24 경계, 코드/장비/옵션·개별 사례·미측정 브라우저 필드, Git 제외 JSON/Markdown 보고서, 기존 ID 보호, 취소/실패 결과와 종료 코드. 환경파일·키·외부 API·원격 DB는 사용하지 않는다.
- 엔진/캔들 집계의 직접 import 경로와 엔진 constructor 필드 선언만 Node type stripping에 맞췄다. 생산 집계 알고리즘과 웹 Provider/store/UI는 바꾸지 않았다. npm test:perf 진입점과 Next trace의 도구/보고서 제외를 추가했고 새 의존성/lockfile 변경은 없다.
- README·문서 02/04와 이 문서의 측정 계약을 갱신했다. 이벤트 단위를 체결로 명시하고 UI 지표/성능 달성/릴리스 판정과 구분했다.

**읽은 근거, 미실행과 다음 단계**

- Node 24 공식 perf_hooks/process/TypeScript 문서와 설치된 타입 선언, 기존 엔진/집계/검증 코드를 읽었다. 소스·diff·Git 상태를 확인하고 파일을 편집했다. 공식 링크와 지표 해석은 §4에 있다.
- **사용자 지시로 test:perf/help·정합성 대조·성능 측정, unit/E2E·lint/typecheck/build·React Doctor·check:public·개발 서버/브라우저 확인을 전부 미실행했다.** 계측 코드는 작성했으나 회귀 테스트는 추가/실행하지 않았다. 측정 보고서/성능 수치를 생성하거나 기존 통과 기록을 소급 적용하지 않는다.
- 남은 확인: Node 24의 TS 경로/문법 및 웹 import 호환, invalid/중복 인자·기존 ID·출력 실패, 취소/시간 초과/불일치·신호 정리, 입력률·모든 체결의 집계와 해시 재현, 메모리 표본/히스토그램 단위, 빌드 추적 제외. 장시간 실행·브라우저 지표·전후 비교는 아직 수행하지 않았다.
- **다음 단계:** P6 브라우저 계측과 검증 진입점 준비. 도구 실행/성능 측정/접근성·릴리스 게이트 검증은 명시 요청 후 수행한다. 측정 근거 없이 Worker/가상화로 확대하거나 P7/릴리스로 넘어가지 않는다.

### 2026-09-30 · P6-A 시세 화면 고정·전체 캔들 수치표 (실행 미검증)

**범위와 Git Flow**

- 깨끗한 `develop` / `bb7c649`에서 origin fetch 후 차이 0을 확인했다. 편집 전에 `feature/p6-accessible-market-reading`을 생성했다. 상시 지시에 따라 기능 커밋·작업 브랜치 푸시·develop 병합/푸시까지 수행한다.
- 기능 커밋 `0b507b5`를 `origin/feature/p6-accessible-market-reading`에 푸시했다. 다시 fetch하고 develop 차이 0을 확인한 뒤 `--no-ff`로 충돌 없이 병합했다. 이 통합 커밋에 README와 현재 Git 상태 기록을 포함하며 실행 미검증 상태를 유지한다.
- 다음 기능 요청에 따라 P6의 접근성 구현을 한 수직 기능으로 제한했다. 측정/검증 보류와 P6 완료 조건 사이의 충돌은 P6 전체 `in_progress`, P6-A `implemented_unverified`로 구분해 기록한다. P2~P5를 done 처리하거나 P7로 넘어가지 않는다.

**작성한 내용**

- `MarketReadingStore`/React 구독을 추가해 현재가·1분 캔들·호가·체결과 표시 세션 상태를 함께 고정한다. 모든 지원 종목의 기존 bounded snapshot을 복사하며 원천 수신/집계는 계속 기존 정책을 따른다. 자동 알림만 억제하고 상세 구독의 참조 수/cleanup 경로를 유지했다.
- `시세 읽기` 제어는 고정·최신 값 한 번 반영·자동 갱신 복귀를 제공한다. 고정 시각은 실제 KST로 표시하고 각 값의 가상/원천 시각과 구분한다. 고정 데이터와 연결 상태는 현재가 아님을 문구로 표시한다. 고정 당시 빈/오류/오래된 자료도 그대로 보여주며 자동 예시 대체를 하지 않는다.
- 재생/연결 제어는 고정을 해제한다. 앱 안의 라우트 이동과 탭 복귀에는 고정을 유지하며 새로고침/unmount에는 버린다. 실제 수신을 멈추거나 누락 구간을 복원하는 기능이 아니며 파일/URL/IndexedDB/백업에 시세를 저장하지 않는다.
- `CandlePanel`을 분리하고 차트/수치표 선택을 추가했다. 수치표 선택은 전체 시세 표시를 고정하고 현재 기간의 모든 캔들을 최신순 20개씩 표시한다. 날짜·KST 시작 시각·OHLC·정확한 문자열 거래량, 표 caption과 scope header, 키보드 스크롤 영역/페이지 버튼을 제공한다. 마지막 캔들/로컬 부분 집계의 한계를 표시한다.
- 자동 갱신 복귀 시 차트로 돌아가고, 명시적인 갱신이나 종목/기간 변경 시 표 첫 페이지부터 읽는다. 갱신 버튼은 교체되는 표 밖에 두고 자동 틱으로 고정 표/페이지/포커스를 변경하지 않도록 작성했다. 과거 일봉과 재무·공시는 고정 범위 밖이다.
- 기존 다크 토큰과 반응형 규칙을 확장했다. 넓은 캔들 수치표의 내부 스크롤을 문서 01에 명시했다. 추가 패키지, Worker/가상화, 검증/성능 script는 도입하지 않았다. README·데이터 설명·문서 01/02/04를 갱신했다.

**읽은 근거와 미실행 항목**

- React 성능 스킬의 구독 범위/사용자 이벤트 처리 지침을 참고했다. [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)와 [WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)을 2026-09-30에 열람해 자동 갱신 제어와 표의 대체 정보 구성을 참고했다. WCAG 준수 판정이나 앱 접근성 검증 결과가 아니다.
- 수행: 문서·소스·diff 읽기, 공식 가이드 열람, 파일 편집과 Git 상태 확인. **사용자 지시로 신규 테스트 작성/실행, lint/typecheck/build, React Doctor, 개발 서버·브라우저·성능 측정과 실제 API 호출은 전부 미실행**했다. 기존 P1-B 통과 기록을 이번 변경에 소급 적용하지 않는다.
- 남은 확인: 고정 중 5종목/세션 숫자 안정성, 수신 지속과 최신 값 교체, pause/reset/배속/재연결 해제, 상세 재진입·기간 변경·숨김 복귀, Strict Mode/구독 정리, 미수신·오류·stale 문구, 표 페이지/큰 거래량/스크린리더·키보드 포커스·좁은 화면. 실제 한투 수신과 공개 차단 역시 미검증이다.
- **다음 단계:** P6의 합성 부하 시나리오·측정 도구 준비와 기존 구현의 실행 검증. 실제 테스트/측정은 명시 요청 후 수행하고, 병목 확인 전 Worker/가상화를 적용하지 않는다. 릴리스/배포는 별도 요청 범위다.

### 2026-09-30 · P5 개인 로컬 한투 브리지·시세 화면 (실행 미검증)

**범위와 Git Flow**

- 깨끗한 `develop` / `6bc97c2`에서 origin fetch 후 차이 0을 확인하고 편집 전에 `feature/p5-local-kis-bridge`를 생성했다. 사용자 상시 지시에 따라 관련 파일 커밋·feature 푸시·develop 병합/푸시까지 진행한다.
- 기능 커밋 `2967f68`을 `origin/feature/p5-local-kis-bridge`에 푸시했다. 다시 fetch하고 develop 차이 0을 확인한 뒤 `--no-ff`로 충돌 없이 병합했다. 이 통합 커밋에 README와 현재 Git 상태 기록을 포함하며 실행 미검증 상태를 유지한다.
- 다음 기능 요청에 따라 P5 코드 범위를 진행했다. P2~P4의 검증 게이트는 사용자 지시로 보류 상태를 유지하며, P5 역시 `implemented_unverified`다. 실제 인증·수신 성공을 주장하지 않는다.

**작성한 내용**

- `tools/kis-bridge`: 자식 프로세스 전용 설정, 메모리 인증/발급 single-flight, 보수적인 REST 큐와 cooldown, 현재가·일봉 정규화, 다중 레코드 체결/호가 파서, ACK 기반 구독 변경, 탭 간 참조 합산과 단일 원천 WS, 제한된 재연결/타이머 정리 코드.
- `dev:kis` launcher는 매번 새 공유 비밀을 만들며 bridge만 키 파일을 읽는다. fixed loopback 8787/3000과 real/KRX만 지원한다. `dev:bridge`는 고급 단독 경로다. 실제 명령은 실행하지 않았다.
- Next 로컬 세션/현재가/일봉 API는 서버 모드·Host/Origin·same-origin 조건을 먼저 확인한다. bridge HTTP는 공유 비밀, 브라우저 WS는 30초 Origin 결합 일회용 티켓과 5초 인증 제한을 사용한다. 티켓/연결/요청/프레임 크기와 버퍼에 상한을 둔다.
- 별도 `LocalBridgeMarketProvider`/store를 기존 합성 UI에 연결했다. DTO 재검증, 최신 WS를 보존하는 REST 응답 경합 처리, 100ms 표시 배치, 숨김/중단/화면 재진입의 새 관측 구간, stale·미수신·오류, 출처/조회 시각/체결 시각 구분, 원주가 일봉 조회 폼과 수치 표를 추가했다.
- 실제 가격 초기값은 null이다. 실제 체결/호가/일봉을 파일·공개 캐시·백업에 쓰는 기능은 없다. 일봉은 원천 달력 미대조 때문에 partial로 표시한다. 교차/빈 호가·새 스키마는 오류로 멈추며 실제 세션/시간외 응답을 대조해야 한다.
- 모드 검증은 개발/local 조건에서만 kis-private을 허용하고 production/public/Vercel에서 차단한다. `check:public`은 synthetic만 허용하도록 보강했지만 실행하지 않았다.

**공식 근거와 실행한 작업**

- 한투 공식 포털의 제휴/유량 안내, GitHub 공식 샘플 HEAD `277ec0eb7a9b7f63b6807829286c80f36649dad2`의 auth·REST·WS·응답 필드·설정/실행 예제를 읽었다. 경로와 파라미터/컬럼 순서는 고정 커밋에 근거하며 상세 링크는 문서 03 §4.6에 있다. 실제 계정/키 존재 여부는 확인하지 않았다.
- 공식 공지 목록에 더 최근의 신규 고객/잠금 유량 제한 안내가 있음을 확인했다. 공개 유량 안내 숫자를 본인 계정의 보장 한도로 쓰지 않고 프로젝트 예산 REST ≤2/s, WS 1개, ≤10등록을 유지했다.
- `ws@8.22.0`, `@types/ws@8.18.2`를 npm registry 및 ws 공식 README 확인 후 devDependencies에 정확한 버전으로 추가했다. `npm install --save-dev --save-exact ws@8.22.0 @types/ws@8.18.2 --ignore-scripts --no-audit --no-fund`: exit 0, 2개 추가. OS Node 26.4.0과 프로젝트 요구 Node 24.x 불일치 경고가 있었으며 Node 24 재설치/실행 확인은 하지 않았다. 의존성 설치가 호환성 검증은 아니다.
- 문서/소스/변경 diff를 읽고 파일을 편집했다. 브라우저는 공식 문서 조사에만 사용했으며 앱을 실행하거나 앱 화면을 검사하지 않았다. 실제 `.env.local` 값과 금융 원천 데이터는 읽지 않았다.

**미실행과 남은 위험**

- 사용자 명시 지시로 typecheck/lint/unit/E2E/build/React Doctor/브라우저 QA/check:public/dev:kis/dev:bridge와 실제 API 인증·시세·일봉 호출을 모두 실행하지 않았다. 새 테스트 작성/기존 모드 테스트 갱신과 실행도 후속 요청 범위다.
- 실행/타입/린트 오류, Node 24 런타임, 티켓 재사용/만료·위조 Origin·잘못된 Host, 다중 탭·Strict Mode·구독 ACK·disconnect cleanup, REST/WS 경합, 연속/다중 프레임·장 경계·호가 상태, 일봉 구간/정렬과 공개 빌드 trace/Network를 확인해야 한다. 코드만으로 보안·수신 성공·성능 수치를 주장하지 않는다.
- 계정별 이용 조건·한도·키, 동시호가/시간외·애프터마켓 필드, 거래일 달력은 미확인이다. 실제 분봉 복원/수정주가/모의 계정/NXT/통합 시세는 지원하지 않는다. 원격 DB·배포·main 릴리스는 수행하지 않는다.
- **다음 단계:** P6 측정·접근성·릴리스 준비. 실제 검증은 사용자 명시 요청 후 수행하고, 실계정 확인은 로컬 키/허용 환경과 별도 실행 요청을 확보한 뒤 진행한다.

### 2026-09-30 · P4 공개 재무 캐시·조회 API·배포 경계 (실행 미검증)

**범위와 Git Flow**

- `develop` / `2ca54f3`의 깨끗한 상태를 읽고 origin fetch 후 차이 0을 확인했다. 편집 전에 `feature/p4-public-financial-cache`를 생성했다. 상시 지시에 따라 관련 파일 커밋·feature 푸시·develop 병합/푸시까지 진행한다.
- 기능 커밋 `ac8770f`를 `origin/feature/p4-public-financial-cache`에 푸시했다. 다시 fetch하여 develop 차이 0을 확인한 뒤 `--no-ff`로 충돌 없이 병합했다. 이 통합 커밋에는 README와 현재 Git 상태 기록을 포함하며 실행 미검증 상태를 유지한다.
- P2/P3 검증과 실제 DART 수집이 남아 있지만 외부 키 없는 다음 기능 개발 지시에 따라 P4 조회 경계를 작성했다. 이전 단계를 done으로 올리지 않고 P4도 implemented_unverified로 남긴다. 실제 데이터·키·계정·배포·main 릴리스는 범위에 넣지 않았다.

**작성한 내용**

- `domain/financials/published.ts`: 회사/기간/원문 URL/금액/검토 날짜를 확인하는 strict 공개 계약, 1MiB/보고서 4개/metric 9개 제한, manifest의 500개 이하 등록 목록. 현재 `data/published/manifest.json`은 합성 생성기 1.1.0/fixture/빈 목록이다.
- `tools/dart/verified-run.ts`로 기존 원천 재구성 검사를 공유하고 `data:publish`를 추가했다. `--confirm-public`과 로컬 검토 기록으로 공개 DTO/manifest 파일을 준비하며 reviewer·운영 경로·원본 응답은 제외한다. 이전 revision을 보존하고 manifest를 마지막에 교체한다. 실제 명령은 실행하지 않았다.
- JSON 파일 경계와 Supabase REST 읽기 전용 repository: 등록된 ID/해시만 읽고 5초 timeout/크기를 제한한다. Supabase 미설정일 때만 JSON, 원격 실패 시에는 오류다. DART 수집·원본 fallback·개인 쿠키/운영 키 사용은 없다. 실제 DB 조회는 하지 않았다.
- runtime-config/종목검색/회사/보고서/공시 GET API를 작성했다. 지원 법인 목록, 필수 보고서 필터, 연도·검색어·query 중복·페이지 범위, 일반 오류 메시지/requestId, no-store/noindex를 적용했다. 원천 API 재수집/refresh POST 경로는 만들지 않았다.
- 재무·공시·기업 비교에서 repository 선택과 EXAMPLE/DART CACHE 구분, 수집/검토/공개 준비일·공식 원문 링크·30일 stale·미설정/미제공/오류를 연결했다. 실제 Q4 손익·분기 CF는 미제공과 보고 누적 참고값을 표시하며 예시 파생기로 계산하지 않는다.
- Supabase CLI 2.118.0의 help/new 명령으로 `20260930102900_public_financial_cache.sql`을 생성·작성했다. 원천 테이블 6개는 stocklab_private, 공개 DTO 테이블은 public에 배치하고 RLS/revoke/SELECT grant를 명시했다. DB 서버/마이그레이션 적용/쿼리/정책 검사는 실행하지 않았다.
- 공개 환경의 KIS/DART/privileged Supabase 변수 및 브라우저 비밀값 차단을 확장했다. Next trace 포함/제외, 전 페이지 noindex, `check:public`과 npm build 전후/start 전 연결을 추가했다. 환경·manifest·파일·출력 검사 도구 자체도 미실행이다.
- checker의 환경파일 로딩을 위해 이미 잠긴 @next/env 16.3.7을 직접 dependency로 명시하고 lockfile 루트 계약을 맞췄다. 다른 패키지 버전/lock 항목은 바꾸지 않았다. README·데이터 설명·문서 01~04와 환경 예제를 갱신했다.

**읽은 근거와 실행하지 않은 항목**

- Supabase/Postgres/React 스킬을 적용했다. ego-browser에서 Supabase changelog, grant/RLS, publishable 키 헤더와 REST 경로, Next file tracing 공식 문서를 읽고 참고 공간을 닫았다. 문서 확인일 2026-09-30이며 출처는 문서 03 §5.5에 기록했다.
- CLI가 설치되어 있지 않아 임시 npm 캐시에 Supabase 2.118.0만 받아 help와 migration new를 사용했다. 이는 SQL 파일 생성이며 애플리케이션 실행 검증이나 DB 변경이 아니다. 프로젝트 npm install/ci는 실행하지 않았다.
- **사용자 지시로 테스트 작성·실행, lint/typecheck/build, React Doctor, check:public, DART CLI/dry-run/공개 준비 명령, 개발 서버·앱 브라우저 검증을 전부 미실행했다.** 관련 스킬의 검증 권고보다 사용자 지시를 우선했다. 소스/diff 읽기와 Git 상태 확인만으로 기능 통과를 주장하지 않는다.
- 실제 DART/KIS API, Supabase 계정/프로젝트 생성·접속·원격 migration/적재, 개인 브라우저 데이터 변경, 배포/PR/main 릴리스는 하지 않았다.

**남은 위험과 다음 작업**

- 타입/빌드/라우트 응답, DTO 거부·cache miss의 외부 요청 부재, 설정 우회, 캐시 철회, SQL 문법·RLS 익명 쓰기 차단, 파일 trace/산출물 검사와 화면 접근성은 실행 미검증이다. 실제 DTO가 0개라 실제 데이터의 end-to-end 조회/표시도 미검증이다.
- manifest/hash는 데이터 생성 경로와 재이용 권한에 대한 독립적인 증명이 아니다. 수동 원문·공개 적합성 검토가 필요하며 바이트 패턴 검사는 모든 변형된 녹화/비밀정보를 탐지하지 못할 수 있다. 배포된 JSON/다운로드는 DB 비공개만으로 회수되지 않는다.
- 검증 요청 시 기본 검사와 기존 테스트의 모드/문구 계약 갱신, P2~P4 회귀·RLS/API/공개 빌드 검증을 진행한다. 기본 검사 미실행은 Git 절차를 보류할 이유로 삼지 않는다.
- **다음 기능:** P5 개인 로컬 한투 중계·읽기 전용 연동 경계. 실제 인증/수신은 키·허용 환경·사용자 요청 범위가 확보됐을 때만 별도 수행하고 미검증을 명시한다.

### 2026-09-30 · P3 관심종목·기업 비교·리서치 노트 (실행 미검증)

**범위와 Git Flow**

- 다음 기능 개발 요청에 따라 P3 한 단계를 진행했다. `develop` / `d247bb9`의 깨끗한 상태에서 원격을 fetch하고 로컬/원격 차이 0을 확인했다. 코드 편집 전에 `feature/p3-personal-research`를 생성했다. 상시 지시에 따라 기능 커밋·브랜치 푸시 후 develop 병합·푸시까지 수행한다.
- 기능 커밋 `a004c05`를 `origin/feature/p3-personal-research`에 푸시했다. 원격 재확인에서 develop 차이 0을 확인하고 `--no-ff`로 충돌 없이 병합했다. 이 통합 커밋에는 README와 현재 Git 상태 기록을 함께 반영한다. 검증 미실행 상태는 그대로 유지한다.
- P2-A/P2-B의 미검증과 실제 수집/원문 대조는 남겨두고, 외부 키 없이 가능한 P3의 fixture 비교와 개인 기록을 구현했다. 이전 단계를 done으로 소급 변경하지 않았다. 개인 클라우드 동기화, 실제 DART/KIS API, 공개 캐시/배포는 이번 범위 밖이다.

**작성한 코드**

- `domain/personal.ts`, `features/personal/`: strict 저장·백업 스키마, IndexedDB `PersonalRepository`, 루트 `PersonalSession`/external store. 관심종목 순서, 노트별 version, 문서 generation/revision을 readwrite transaction 안에서 비교하고 저장한다. 실제 완료 이벤트 이후 저장 성공 표시, open/transaction timeout, 오류·차단 안내를 작성했다.
- `/watchlist`: 관심종목 추가/해제/위아래 정렬. 홈·상세 별표와 저장 목록을 공유한다. 최초는 빈 목록이다. 기존 `symbols` URL은 임시 목록을 유지하고 명시적인 추가 버튼으로 저장 목록에 합친다.
- `/notes`: 종목 필터/제목·핵심 생각 검색, 신규/수정/삭제, 제목/종목/생각/근거/위험/체크리스트/회고/날짜. 600ms 자동 저장, 즉시 저장, 입력 이탈/탐색/탭 숨김 flush, beforeunload 안내와 라우트 밖 미저장 초안 배너를 작성했다. 초안은 루트 세션에 보존하고 제목/본문을 URL·로그·네트워크로 전달하지 않는다.
- 다른 탭 변경 알림과 포커스/가시성 복귀 때 DB를 다시 읽는다. dirty 초안은 자동 대체하지 않고 충돌 시 최신본 읽기/사본 저장을 제공한다. 실제 수정 충돌은 DB의 버전 검사로 막도록 작성했으며 BroadcastChannel이 지원되지 않아도 버전 검사를 우회하지 않는다.
- `backup-controls.tsx`: 저장된 개인 기록의 JSON 내보내기, 파일 크기/형식 확인, 개수 미리보기 후 사본 추가 가져오기, 확인 후 로컬 초기화. 최대 2MiB/노트 200개, unknown 필드/잘못된 종목·날짜·ID/중복 거부. 가져오기·초기화는 전체 revision 비교와 단일 transaction. 미저장 초안은 일반 텍스트로 별도 내보내며 HTML로 실행하지 않는다.
- `domain/comparison.ts`, `/compare`, `features/compare/`: 지원 기업 0~3개, 연간/단일 분기·연도·연결/별도·차트 항목 URL, 병렬 fixture repository 조회, 표/영업이익률/공통 축의 금액 막대. 기간/통화/기준/출처 불일치는 비교 불가, 누락/오류/오래된 예시는 별도 안내한다. 원 단위·계산 근거는 기존 재무 셀을 재사용한다.
- 헤더/홈/상세에 새 화면 연결, 최근 노트와 로컬 저장 안내, 모바일 메뉴/표/노트 편집 CSS, `/about/data`와 README·문서 01~05를 갱신했다. React Hook Form/idb/차트 의존성은 추가하지 않았으며 기존 의존성/lockfile은 변경하지 않았다.

**자료 참고와 미실행 항목**

- React 성능/UI 스킬을 읽고 기존 중립 다크 토큰·시스템 글꼴·재무 표 스타일을 확장했다. 시장 틱과 개인 데이터의 store를 분리하고 시세 행의 개인 버튼에는 memo 경계를 뒀다. 성능 개선 수치를 측정하거나 주장하지 않는다.
- ego-browser로 [MDN IndexedDB 가이드](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)를 2026-09-30에 읽고 transaction 완료, 버전 변경, 브라우저 종료 시 제약을 참고했다. 자료 공간은 닫았으며 앱/실제 개인 데이터를 브라우저에서 조작하지 않았다.
- 사용자 상시 지시에 따라 신규 테스트 작성/실행, lint/typecheck/build, React Doctor, 개발 서버/브라우저 UI 검증을 **전부 미실행**했다. 관련 스킬의 실행 권고보다 사용자 지시를 우선했다. Git 상태/diff와 소스 읽기는 수행했지만 기능이 통과했다는 검증 결과로 보지 않는다.
- 설치/외부 금융 API/키 설정/원격 DB/배포/PR/main 릴리스는 실행하지 않았다. 실제 브라우저 저장소에 기록을 생성·삭제·초기화하거나 백업을 내보내지 않았다.

**남은 위험과 다음 작업**

- TypeScript/React 렌더링, 자동 저장과 입력/페이지 이동 경합, IndexedDB 용량·권한·트랜잭션 중단, 다중 탭/초기화 충돌, 모바일/보조공학/키보드, 손상·대용량 백업, 비교 기간 라벨은 실행 미검증이다. 기존 P1-B 홈 URL 선택 테스트는 별표의 영구 저장 계약에 맞춰 갱신해야 한다.
- 브라우저 강제 종료·데이터 삭제의 무손실 저장은 보장하지 않는다. 저장 상태 안내와 JSON/초안 텍스트 내보내기로 사용자가 보관할 수 있도록 했다. 클라우드 동기화와 과거 노트 버전 복원은 미구현이다.
- **다음 기능:** P4 공개 재무 캐시/조회 경계와 공개 환경 안전장치. P2/P3 검증과 실제 DART 수집·원문 대조는 사용자 요청 시 별도로 진행하며 미검증 상태를 유지한다.

### 2026-09-30 · P2-B 로컬 DART 수집·검토 도구 (실행 미검증)

**범위와 저장소**

- 사용자 다음 기능 개발 요청에 따라 P2-B 로컬 도구 코드를 작성했다. `develop` / `dcdc858`의 깨끗한 상태에서 `git fetch origin` 후 로컬/원격 차이 0을 확인하고 **코드 편집 전에** `feature/p2b-dart-ingestion`을 생성했다.
- 사용자 상시 Git Flow 지시에 따라 기능 커밋·작업 브랜치 푸시 후 develop 병합·푸시까지 수행한다. main/PR/릴리스/배포/원격 DB는 범위에 포함하지 않는다.
- 기능 커밋 `80330b5` (`feat(data): add local DART collection and review tools`)의 관련 파일 19개를 원격 `feature/p2b-dart-ingestion`에 푸시했다. 원격을 다시 fetch하고 develop 차이 0/작업 트리가 깨끗함을 확인한 뒤 `git merge --no-ff --no-commit feature/p2b-dart-ingestion`을 충돌 없이 적용했다. 이 통합 기록을 `chore(repo): merge DART ingestion tools into develop` 병합 커밋에 포함해 원격 develop으로 푸시한다.
- P2-A 완료 게이트와 “다음 단계” 사이의 충돌은 최신 사용자 지시를 우선해 처리했다. P2-A 검증을 임의로 실행하거나 done 처리하지 않고 P2-B의 수집 도구를 개발했다. 키의 존재/유효성은 확인하지 않았으며 실제 수집 완료 또는 키 미설정 확정을 주장하지 않는다.

**작성한 코드와 문서**

- `tools/dart/{schema,errors,options,client,corporations,store,collect,sync,review-model,review}.ts`: Zod 외부 응답/저장 상태, 지원 종목·연도·보고서·기준 인자, 고정 DART endpoint, 금액/회사 식별자 검증, 고유번호 ZIP/XML과 기업 개황 대조, 정기공시 pagination, 선택한 재무 보고서 수집 후보.
- 동시 1개/최소 700ms/기본 1,000회 누적 예산과 timeout, 최대 2회 일시 오류 재시도, SIGINT/SIGTERM 취소. 예산은 호출 전에 기록하고 실패 재개에도 보존한다. 오류·키·URL·stack 출력 차단, ZIP 크기/항목/경로 제한, XML DTD/엔티티 처리 차단.
- SHA-256별 원본 보존, 성공 작업 체크포인트, 원자적 상태 저장, 로컬 중복 실행 잠금. 신규 ID로 이전 원본/정정 수집 기록 보존. keyless dry-run은 계획만 출력하도록 작성했다.
- 원문 대조 양식은 회사/기간/기준/금액·누적 금액/전체 순이익 범위를 직접 확인해야 채울 수 있도록 빈 상태로 생성한다. 내보내기 때 실제 원본에서 후보를 재구성하고 해시/접수번호/행/금액을 확인한다. 실제 자료의 계정 ID를 추정하거나 fixture에 opendart 태그를 붙이지 않는다.
- DTO는 명시적 필드만 골라 Git 제외 로컬 폴더로 생성한다. 12월 결산/KRW, 검토한 보고/누적 금액까지만 지원한다. 정정 필요·철회 표시/미확인 원문은 내보내기를 거부하고 누락은 null+사유로 보존한다. 실제 Q4/CF 단일 분기 파생과 UI/cache 연결은 실제 표본 검증 이후로 남겼다.
- package.json의 `data:sync`, `data:review`, Node TypeScript 실행을 위한 tsconfig 설정, README/환경 예제와 문서 02/03/04/05에 절차·제한을 반영했다. `.env.local`/원본/검토/내보내기 파일은 만들지 않았다. 기존 앱의 synthetic/fixture/local 모드와 UI는 변경하지 않았다.

**자료와 의존성**

- 2026-09-30 ego-browser로 공식 DART [고유번호](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018), [기업 개황](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002), [공시 검색](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001), [전체 재무제표](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020)를 확인했다. 키 입력/API 테스트 폼을 실행하지 않았고 자료용 브라우저 공간은 닫았다.
- [fflate 공식 저장소](https://github.com/101arrowz/fflate)와 [fast-xml-parser 공식 저장소](https://github.com/NaturalIntelligence/fast-xml-parser), npm 버전/라이선스 메타데이터 및 설치된 타입/구현을 읽었다. ZIP/XML 처리를 위한 두 devDependency를 각각 `0.8.3`, `5.11.2`로 고정했다. 애플리케이션 의존성의 무관한 업데이트는 하지 않았다.
- 실제 설치 명령: `npm install --save-dev --save-exact --ignore-scripts --no-audit --no-fund fflate@0.8.3 fast-xml-parser@5.11.2`, exit 0, 전이 의존성 포함 9개 패키지 추가. 시스템 Node 26.4.0/npm 11.17.0에서 실행되어 프로젝트 Node 24.x 요구와의 EBADENGINE 경고가 있었다. 지정 Node 버전은 변경하지 않았다. 설치 script/audit는 실행하지 않았다.

**검증과 남은 일**

- 수행: 문서/소스/설치된 라이브러리 읽기, 공식 개발가이드 열람, 의존성 설치, 파일 편집, Git 상태/diff 확인. 기능이 실행됐거나 통과했다는 근거가 아니다.
- 사용자 지시로 테스트·린트·타입 검사·빌드·React Doctor·브라우저 UI 검증 및 새 CLI의 help/dry-run/실수집/원문 검토·export를 **모두 미실행**했다. 신규 자동화 작성도 별도 요청 시 진행한다. 실제 금융 API 호출 0회, 키 발급/설정/원격 DB/배포 미실행이다.
- 남은 위험: TS/CLI 호환성, ZIP/XML 실제 형식, API 변화·pagination, 재개/잠금/취소 경합, 비밀값 차단과 검토 gate는 실행 확인하지 않았다. 해시는 파일 간 일치성을 확인할 뿐 수동 원문 대조의 진실성을 증명하지 않는다. 웹은 여전히 예시 데이터만 제공한다.
- **다음 한 가지 작업:** 사용자가 검증/수집을 요청하면 지정 Node 24에서 P2 도구와 파서 검증 후 회사 하나의 실제 사업·3분기 보고서를 수집·원문 대조한다. 키가 없다면 실제 수집을 blocked로 남긴다.

### 2026-09-30 · P2-A 커밋·통합 및 상시 Git Flow 지시

- 사용자가 P2-A를 커밋·작업 브랜치 푸시 후 develop에 병합·푸시하도록 요청하고, 앞으로 같은 절차를 반복해서 지시하지 않도록 기억하라고 요청했다.
- 루트 AGENTS.md와 README에 **개발 전 작업 브랜치 생성 → 구현 → 커밋·작업 브랜치 푸시 → develop 병합·푸시**를 개발 요청에 포함된 상시 권한으로 기록했다. `main` 릴리스, PR 생성, 배포, 원격 DB는 이 권한에 포함하지 않는다. 이전 기록의 개별 Git 승인 규칙은 당시 정책이며 이번 지시로 갱신된다.
- 작업 브랜치는 `feature/p2a-financial-fixtures`, 시작 기준은 `59e98ba`다. `git fetch origin`으로 원격 상태를 갱신했다. 커밋 대상은 P2-A 구현과 관련 문서/규칙 23개 파일이며 메시지는 `feat(financials): add fixture financial statements and filings`다.
- 작업 커밋 `430a5f1`을 원격 `feature/p2a-financial-fixtures`에 푸시하고 추적 브랜치를 설정했다. develop에서 `git merge --no-ff --no-commit feature/p2a-financial-fixtures`를 충돌 없이 적용했으며, 이 상태 기록을 `chore(repo): merge financial fixtures into develop` 병합 커밋에 포함한다. 원격 develop에도 같은 병합 커밋을 푸시하는 요청이다.
- 테스트·린트·타입 검사·빌드·React Doctor·브라우저 검증을 실행하지 않았다. P2-A 상태는 `implemented_unverified`를 유지하며, Git 통합이 기능 검증 완료를 뜻하지 않는다. 앱 코드에 이번 Git 요청으로 추가 변경하지 않았다.
- 다음 작업은 사용자가 요청하는 P2-A 후속 작업이다. 자동화 작성·실행과 실제 DART 수집은 아직 남아 있다.

### 2026-09-30 · 개발 전 작업 브랜치 규칙 정리

- 사용자가 개발 전에 작업 브랜치를 먼저 만들어야 한다고 지시했다. 이전의 “브랜치 생성은 개별 명시 요청 시에만” 규칙은 이 지시로 갱신한다. 개발 요청에는 최신 develop에서 목적별 작업 브랜치를 생성·전환하는 권한이 포함되며, 이미 해당 작업 브랜치가 있으면 이어서 사용한다.
- `git fetch origin` 후 로컬 develop과 origin/develop이 모두 `59e98ba`임을 확인했다. `git switch -c feature/p2a-financial-fixtures develop`으로 브랜치를 생성하고 P2-A의 수정/미추적 파일을 그대로 보존했다. develop/main의 커밋은 변경하지 않았다.
- 루트 AGENTS.md, README와 이 문서에 현재 브랜치와 앞으로의 절차를 반영했다. 검증은 요청 시에만 실행한다는 기존 사용자 지시도 루트 규칙에 명시했다.
- 테스트·린트·타입 검사·빌드·React Doctor·브라우저 검증과 commit/push/merge/PR은 실행하지 않았다. 다음 작업은 이 브랜치에서 P2-A 후속 요청을 처리하는 것이다. P2-A 실행 검증은 사용자 요청을 기다린다.

### 2026-09-30 · P2-A 예시 재무·공시 구현 (실행 미검증)

**범위와 저장소**

- 다음 기능 개발 요청에 따라 P2-A만 진행했다. 시작 상태는 `develop` / `59e98ba`이며 작업 트리가 깨끗했다. 새 브랜치 생성, commit/push/merge/PR과 배포는 실행하지 않았다. 코드 변경은 현재 체크아웃에 남긴다.
- 최신 사용자 지시인 “테스트 같은 것은 요청할 때까지 하지 않기”를 유지했다. 테스트·린트·타입 검사·빌드·React Doctor, 개발 서버 실행/브라우저 UI 확인을 하지 않았다. 신규 자동화 테스트도 후속 요청 시 작성·실행할 항목으로 남겼다. P2-A를 완료 처리하지 않는다.

**작성한 코드**

- `src/domain/financials/{model,amounts,normalize,view}.ts`: 회사와 종목 식별 구분, Zod 예시 원천 스키마, normalized DTO, 큰 원 금액의 문자열/BigInt 처리. 공백/대시/형식 오류와 0 구분, 쉼표/괄호 음수, 원 단위 보존과 표시 때만 반올림.
- `src/data/fixtures/financials.ts`, `src/server/repositories/fixture-financial-repository.ts`: 5종목의 직접 작성한 2023~2025 연간/2025 분기 예시. 실제 DART ID·접수번호·수집일·원문 URL 없음. 삼성전자 화면용 정정 이력/지배주주 항목 구분, NAVER 별도 미제공/CIS, LG전자 큰 정수/비표준 및 IS·CIS 후보 중복, 현대자동차 재작성 기준 불일치/누락, SK하이닉스 음수 손익/CF 기간 미확인 시나리오. 실제 기업의 사실을 표현한 사례가 아니다.
- IS/CIS 1~3분기는 직접 3개월 금액, Q4는 연간−9개월 누적. CF는 의미가 명시된 누적값끼리 차감하고 BS는 기말값 유지. 회사/기간/기준/재작성 키가 다르거나 필요한 계정/누적 금액이 없으면 계산하지 않고 사유를 담는다. 같은 항목의 여러 후보는 ambiguous다.
- `features/financials/`, `features/filings/`, 종목 상세 route/component와 `market-view.ts`: 재무·공시 탭, 연결/별도·연간/분기·연도 URL 필터, 잘못된 값 redirect. 서버 슬롯으로 재무와 시장 store를 분리한다. 예시 고지, 요약 수치, 손익 막대, 상세 표, 금액별 원 단위/기간/계정/정정 버전/계산 근거 펼치기, 공시 목록과 공식 검색 사이트 링크를 추가했다.
- 로딩은 서버 Suspense/필터 transition, 빈 자료와 오류는 별도 메시지, 오래된 예시는 작성 후 180일 기준 안내를 작성했다. stale은 실제 DART 최신성을 뜻하지 않는다. 표 내부 가로 스크롤, 작은 화면 필터/목록 배치, 키보드용 select/details와 차트 수치 대체 정보를 CSS/마크업에 반영했다. 실제 렌더링/접근성 결과는 미확인이다.
- 데이터 설명, 메타 설명, README와 문서 02/03/05를 갱신했다. 의존성과 lockfile은 변경하지 않았다. 외부 API/키/원격 DB를 사용하지 않았다.

**공식 자료 참고와 설계 차이**

- 2026-09-30 ego-browser로 [전체 재무제표 개발가이드](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020), [공시 검색 개발가이드](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001)를 읽었다. 손익 3개월/누적 필드, 보고서 코드, 정정 표기와 공식 원문 링크 형식을 참고했으며 API 테스트 폼은 실행하지 않았다. 자료 확인용 브라우저 공간은 닫았다.
- 실제 DART HTTP 응답 parser/표준 XBRL 및 기업별 매핑/원천 hash는 P2-B에 남겼다. 이번 parser는 공식 필드 의미를 반영한 자체 fixture 계약 전용이다. `fixture:*` 계정 ID를 실제 계정이라고 주장하지 않는다.
- 초기 설계의 TanStack Query/Recharts는 이번 서버 로컬 fixture에 도입하지 않았다. 별도 HTTP 조회와 차트 상호작용이 필요해질 때 도입한다. 현재 막대는 BigInt로 계산한 제한된 표시 비율만 Number로 바꾸고, 수치 표는 원 단위를 그대로 보존한다.

**검증과 남은 일**

- 실행한 작업: 저장소/문서/코드 읽기, 공식 가이드 참고, 파일 편집과 Git 상태/diff 확인. 자동화 및 실행 검증 명령은 **0회**다. 기존 44개 unit/10개 E2E의 성공 기록을 이번 변경에 적용하지 않는다.
- 남은 위험: 컴파일/린트 오류, 브라우저 배치·서버 렌더링, 재무 파서/기간 라벨 회귀는 실행 확인하지 않았다. F04/F05/F06과 큰 금액/빈 값/정정/기준 불일치/필터 복원/출처 구분 자동화 작성·실행이 필요하다. 실사용 가능한 실제 기업 재무로 간주하면 안 된다.
- **다음 한 가지 작업:** 사용자가 검증을 요청하면 P2-A 자동화와 기본/UI 검증을 진행한다. 그 전에는 P2-A를 done으로 올리거나 P2-B 실제 수집 완료를 주장하지 않는다.

### 2026-09-30 · develop 통합 (사용자 요청)

- 사용자가 `feature/p0-p1a-synthetic-market`을 `develop`에 병합하고 푸시하도록 요청했다. 원격을 fetch한 뒤 로컬/원격 develop 및 작업 브랜치가 각각 동일하고 작업 트리가 깨끗함을 확인했다.
- 병합 대상은 `212bad7`까지의 P0/P1-A/P1-B 구현이다. `git merge --no-ff --no-commit feature/p0-p1a-synthetic-market`은 충돌 없이 적용되었으며, 이 진행 기록을 같은 병합 커밋에 포함한다. 커밋 메시지는 `chore(repo): merge synthetic market implementation into develop`이다.
- 최신 사용자 지시에 따라 테스트·린트·타입 검사·빌드·React Doctor는 실행하지 않았다. 이후에도 사용자가 명시적으로 요청할 때만 검증 명령을 실행한다. 아래 과거 검증 기록은 당시 실행 결과이며 이번 병합의 재검증 결과가 아니다.
- 애플리케이션 코드에 추가 변경을 하지 않았다. main 병합, PR 생성, 배포, 외부 API/원격 DB 작업은 실행하지 않았다. 다음 기능 단계는 **P2-A 재무 파서와 예시 fixture 계약/표**다.

### 2026-09-30 · P1-B 커밋·푸시 사전 검증 (사용자 요청)

- 사용자가 현재 변경사항의 커밋·푸시를 요청했다. 대상은 기존 `feature/p0-p1a-synthetic-market`의 P1-B 구현, 테스트와 관련 문서 총 23개 파일이다. 새 브랜치, PR, merge, 배포는 요청 범위에 포함하지 않는다.
- 원격 작업 브랜치가 로컬 HEAD `50bec51`과 같고 main/develop도 기존 초기 기준임을 `git ls-remote --heads`로 확인했다. 커밋 메시지는 `feat(market): add multi-symbol synthetic playback controls`다.
- 이번 검증은 로컬에 설치된 **Node 24.20.0 / npm 11.17.0**을 명령 실행 경로에만 적용했다. package.json의 Node 24.x 범위를 충족하지만 `.nvmrc`의 24.21.0과 패치 버전은 다르다. 런타임 설정과 의존성은 변경하지 않았다.
- `npm run typecheck`, `npm run lint`, `npm run test:unit`(**44/44**), `npm run build`, `npm run test:e2e`(Chromium desktop/mobile **10/10**)가 최종 exit 0이었다. `npx --yes react-doctor@latest --verbose --scope changed`는 origin/main 비교, **100/100**, 진단 없음이었다. 성능 측정 수치가 아니다.
- 초기 build/E2E는 실행 환경의 로컬 포트 제한(EPERM)으로 실패했다. 허용된 실행 권한에서 loopback listen을 확인하고, 실패가 남은 Turbopack 캐시를 저장소 밖 임시 경로에 보존·분리한 뒤 같은 코드로 build/E2E가 통과했다. E2E의 NO_COLOR/FORCE_COLOR 안내는 남았으며 테스트 실패는 없었다.
- README의 미커밋 상태 문구와 이 문서의 Git 상태/검증 기록을 갱신했다. `.env`, 실제 금융 데이터, 빌드/테스트 산출물과 진단 로그는 커밋 대상에서 제외한다. 기존 P1-B 애플리케이션 코드는 추가 수정하지 않았다.
- KIS/DART/Supabase 실제 연동, 원격 DB, 배포, 수동 브라우저 탐색, Safari/Firefox 및 장시간 부하 측정은 이번에 실행하지 않았다. 다음 기능 단계는 **P2-A 재무 파서와 예시 fixture 계약/표**다.

### 2026-09-30 · 프로젝트 파악 및 현재 코드 재검증

- 요청 범위는 프로젝트 파악이다. 지정된 문서 순서와 실제 라우트, 의존성, 합성 엔진/Provider/store/React 구독, 환경 검증, 테스트를 대조했다. 애플리케이션 코드는 수정하지 않았으며 이 기록만 추가했다.
- 현재 체크아웃은 `feature/p0-p1a-synthetic-market`, HEAD는 `50bec51`이다. 작업 시작 시 P1-B 관련 tracked 수정 20개와 untracked 파일 3개가 있었으며 모두 보존했다. Git 변경 명령은 실행하지 않았다.
- 실제 구현 범위는 P0/P1이다. 홈, 종목 상세, 데이터 설명과 5종목 합성 시세가 있으며 선택 목록은 URL에 저장한다. 재무/공시, 비교, 영구 개인 저장, 외부 연동, 배포는 후속 범위다. 설계의 TanStack Query, React Hook Form, Recharts, IndexedDB, Supabase는 현재 구현/설치된 것으로 해석하지 않는다.
- 문서 불일치: 문서 01의 `상태: 구현 전`, 문서 04의 `실행 가능한 Next.js 앱이 아직 없다`는 초기 명세 작성 시점의 표현으로 현재 코드 및 이 문서 7절과 다르다. 이번 파악에서는 초기 문구를 근거로 앱을 재생성하거나 단계 상태를 되돌리지 않고, 실제 코드와 최신 진행 기록을 현재 상태의 근거로 삼았다.
- 실제 재검증: 시스템 Node **26.4.0** / npm **11.17.0**에서 `npm run typecheck`, `npm run lint`, `npm run test:unit`(5개 파일, **44/44**), `npm run build`, `git diff --check` 모두 exit 0. 프로젝트 지정 런타임은 여전히 Node 24.x / `.nvmrc` 24.21.0이며 이번 결과가 지정 런타임 재검증을 대신하지 않는다.
- 미실행: 이번에는 UI 변경이 없어 E2E와 수동 브라우저 확인을 반복하지 않았다. 기존 Chromium E2E 10/10 기록은 아래 P1-B 작업의 결과다. KIS/DART 실제 API, Supabase/원격 DB, 배포도 실행하지 않았다.
- 남은 제한: 지정 Node 24 재검증, 실제 OS 백그라운드/다중 브라우저/장시간 부하 검증, 외부 연동은 이번 파악에서 추가 확인하지 않았다. **다음 한 가지 작업은 P2-A 재무 파서와 명확한 예시 fixture 계약/표**이며 이번에는 착수하지 않았다.

### 2026-09-30 · P1-B 완료

**범위와 저장소**

- 다음 미완료 단계 P1-B 하나만 진행했다. 시작 시 `feature/p0-p1a-synthetic-market` / `50bec51`의 working tree가 깨끗함을 확인했다. 기존 구현과 첨부 AGENTS.md를 보존했다.
- main/develop은 초기 기준, 기존 구현은 원격 feature에 있다. 이번 후속 구현에서 새 branch/commit/push/merge/PR은 실행하지 않았고 변경은 현재 체크아웃에 남겼다. 지난 Git 업로드 요청은 이전 작업에서 완료된 기록이다.

**변경 파일과 구현**

- `src/domain/instruments.ts`, 검색: 삼성전자 005930, SK하이닉스 000660, NAVER 035420, 현대자동차 005380, LG전자 066570. 문자열 코드/대소문자 검색과 다종목 키보드 선택. 기준가는 자체 임의 상수이며 실제 가격이 아니다.
- 표시 식별자 참고: [SK하이닉스 IR](https://www.skhynix.com/ir/UI-FR-IR99/), [NAVER 주가정보](https://www.navercorp.com/investment/stock), [현대자동차 IR](https://www.hyundai.com/worldwide/en/company/ir/stock-information/stock-information), [LG전자 IR](https://www.lg.com/global/investor-relations/). 실제 가격/재무 수치를 복사하지 않았다.
- `providers/*`, `stores/market-store.ts`, `market-context.tsx`: scheduler 하나와 5종목 공유 가상 시각, 종목/채널 격리, quote 목록/상세/공유 상태별 구독. 배속이 달라도 같은 가상 시간의 체결·OHLC·거래량이 동일하다. 전체 reset은 새 세션/버퍼와 정지/배속 보존. 숨김 timer 제거와 backlog 없는 복귀, 수동 정지 유지, Strict Mode visibility cleanup. M01~M07/M14.
- `market-view.ts`, 상세 route/component: URL 기간(세션/30분/15분)·탭(개요/호가/체결) reload/back 복원과 잘못된 값의 안전한 redirect. 1분 집계 간격과 조회 기간 구분. 종목별 제목/미지원 404.
- 홈/재생 제어/CSS: 5종목 스트림, 별표 선택 목록/URL/빈 목록/돌아가기. 데스크톱 2열, 모바일 세로 배치와 모든 선택 버튼/기간/탭 표시. 합성 고지/로딩/오류/stale/차트 대체 표 유지. 영구 개인 저장은 P3. U06~U09.
- `price-chart.tsx`: 4배속이 분 경계를 넘을 때 이전 분의 마감 OHLC·거래량을 먼저 갱신한다. 새 분 append, reset setData, unmount chart.remove 회귀 테스트 추가.
- README와 문서 02 구현 계약, 이 문서 상태/검증 기록 갱신. 의존성/lockfile 변경 없음.

**실제로 실행한 검증 (Node 24.21.0 / npm 11.17.0)**

| 명령 / 검사 | 최종 결과 |
|---|---|
| `npm run typecheck` | exit 0, strict tsc / Next route 타입 통과 |
| `npm run lint` | exit 0, 오류/경고 0 |
| `npm run test:unit` | exit 0, 5개 파일 44/44 통과 |
| `npm run build` | exit 0, production build 성공 |
| `npm run test:e2e` | exit 0, Chromium desktop/mobile 10/10 통과, 최종 CSS 포함 재실행 |
| `npx react-doctor@latest --verbose --scope changed` | exit 0, 100/100, 진단 없음. origin/main 비교이며 성능 측정 수치가 아님 |
| `npm run start -- --port 3201` | Ready, 로컬 production 직접 탐색 |
| `git diff --check` | exit 0, 공백 오류 없음 |

Unit: 같은 가상 시간의 1/2/4배속 체결/호가/캔들/누적량을 5종목 모두 대조, 종목·채널 격리, 전 종목 reset 원자성, timer 하나, 숨김 시작/120초 정지/복귀, 수동 정지 유지, 20회 상세 구독 교체/cleanup, history, URL whitelist/중복/빈 선택, 기간 필터, 다종목 검색, React visibility listener, 분 경계 chart adapter. 기존 P0/P1-A 테스트 포함.

E2E: 기존 keyless/offline/정합성/pause/reset/resize에 5종목 공유 시각, 다른 종목 상세로 이동 시 값 유지, 4배속 전체 reset, 모바일 별표 해제/빈 목록/reload, 기간/탭 reload/back/invalid URL, 가로 넘침 없음 추가. 핵심 흐름 외부 HTTP/pageerror 0건. visibility는 document의 제어된 플랫폼 이벤트와 Playwright 시계로 검증했다.

**브라우저 확인과 해결한 문제**

- ego-browser에서 다종목 홈, NAVER 검색/상세, 2배속·정지·최근 15분 URL 선택을 직접 조작했다. 실제 Playwright desktop/mobile PNG로 홈/상세 화면을 시각 검토했다.
- 초기 E2E에서 기존 광범위한 `nav a:first-child`/마지막 table cell 숨김이 모바일의 새 개요 탭/별표도 숨겼다. 헤더 메뉴로 규칙을 제한하고 모바일 선택 열을 표시한 뒤 통과했다.
- 새 배속 select로 기존 무명 combobox 검색이 모호해져 접근 가능한 이름으로 구분했다. 홈 route 완료 전 evaluateAll이 빈 배열을 읽던 테스트는 목록 표시를 먼저 기다리게 고쳤다.
- React Doctor 초기 85점의 lookup/복잡도 진단은 선택 Set과 실제 가격/캔들 패널 분리로 해결하고 100점 재검증했다. 규칙 비활성화 없음.

**미실행과 제한**

- KIS 계좌/인증/REST/WS, DART 수집/파서/원문 대조, Supabase/원격 DB, 배포, 신규 Git 변경 명령은 미실행. 금융 원천 API 호출 없음. 표시 식별자 참고 웹 검색만 수행했다.
- 의존성 변경이 없어 이번 `npm ci`와 공개 설정 차단 build 반복 검사는 하지 않았다. P0/P1-A의 기존 검증 기록을 아래에 보존했다.
- 실제 OS 백그라운드 동작은 미검증. ego Page 관찰 시 visibilityState가 visible로 유지돼 실제 hidden 검증 근거로 삼지 않았다. 제어된 visibility 이벤트와 root listener cleanup, 숨김 중 timer 0은 자동화로 확인했다.
- Safari/Firefox/실제 보조공학, 30분 실행/부하 측정은 미실행(P6). 합성 1분 세션/100원 호가 규칙이며 실제 거래소 규정 구현을 뜻하지 않는다.

**다음 한 가지 작업:** P2-A 재무 파서와 명확한 예시 fixture 계약/표. 실제 DART 수집은 P2-B로 남긴다.

### 2026-09-30 · Git Flow 최초 업로드 준비 (사용자 요청)

- 사용자가 `https://github.com/ddoniddoni/stocklab.git`에 Git Flow에 맞춰 커밋·푸시하도록 요청했다.
- 원격은 브랜치/태그 없는 빈 저장소였고 GitHub `isEmpty=true`, 쓰기 권한을 확인했다. 로컬에도 `.git`이 없었다.
- `chore/initialize-repository`에서 `.gitignore`와 첨부 `AGENTS.md`만 포함한 `d5cef88` (`chore(repo): initialize git flow foundation`)을 만들었다.
- 이 초기 커밋을 가리키는 `main`과 `develop`을 구성하고 `develop`에서 `feature/p0-p1a-synthetic-market`을 생성했다. 구현 커밋은 작업 브랜치에 만든다.
- 작업 커밋 메시지: `feat(market): add keyless synthetic stock research flow`.
- 푸시 전 Node 24.21.0 / npm 11.17.0에서 `npm run typecheck`, `npm run lint`, `npm run test:unit` (32/32), `npm run build`, `npm run test:e2e` (4/4)를 다시 실행했고 모두 exit 0이었다.
- 빈 환경 예제와 실제 구현/설정/문서/테스트만 커밋 대상으로 선정했다. `node_modules`, `.next`, 테스트 캡처/trace, coverage, 실제 `.env.local`은 제외했다.
- 원격 업로드 대상은 `main`의 초기 기준, `develop`의 동일 초기 기준, 검증한 작업 브랜치다. 일반 작업 PR의 대상은 `develop`, 안정 릴리스는 `develop → main`이다.
- 앞선 P0/P1-A 구현 기록의 "Git 미실행"은 당시 상태를 보존한 기록이다. 이후 Git 작업은 이번 사용자 요청에 따라 시작했다.

### 2026-09-30 · P0 / P1-A 완료

**범위와 초기 상태**

- `/Users/ddoni/Downloads/StockLab_Codex_Development_Docs`에는 문서와 환경 예제만 있었고 앱/package.json/Git 저장소는 없었다.
- `/Users/ddoni/dev`는 Git 저장소가 아니며 `stocklab` 폴더가 없음을 확인한 뒤 `/Users/ddoni/dev/stocklab`을 새로 생성했다. Git 초기화/branch/commit/push/PR은 실행하지 않았다.
- 첨부 `AGENTS.md`, 기존 docs 5개, 루트/브리지 환경 예제를 보존했다. Next 개발 서버가 추가하는 지침 블록은 `agentRules: false`로 비활성화하고 AGENTS.md 원문 동일성을 확인했다.
- P1-A까지 완료한 기록이며 P1 전체, P2~P7 또는 공개 릴리스 완료를 뜻하지 않는다.

**구현 및 주요 파일**

- `package.json`, 단일 `package-lock.json`, `.nvmrc`, `tsconfig.json`, Next/ESLint/PostCSS/Vitest/Playwright 설정, `.gitignore`: npm, strict + noUncheckedIndexedAccess, `@/*`, Tailwind/CSS 토큰, 산출물/환경/원본 데이터 제외.
- `src/lib/config.ts`, `src/server/config/index.ts`, `next.config.ts`: 서버/클라이언트 검증, 키 없는 기본값, 미지원 모드 거부, 공개 환경의 로컬 브리지/수집용 키 거부. 비밀 값은 오류에 포함하지 않고 명시적 공개 DTO만 전달.
- `src/domain/market.ts`, `candles.ts`, `instruments.ts`: Zod source/venue/가격/수량/호가 검증, 문자열 종목코드, 1분 OHLC/거래량 집계. 별개 동일 체결을 제거하지 않는다. 과거 분봉 bucket 역전은 거부하며 합성 공급기는 세션 내 시간순으로만 생성한다.
- `src/features/market/providers/*`, `stores/market-store.ts`, `market-context.tsx`: seed 기반 단일 생성기/가상 시계/초당 1회 scheduler. 40분의 자체 생성 이력과 이어지는 시세. quote/trade/book 발행 전 완성된 스냅샷 교체. 마지막 listener 해제/dispose 시 timer 정리. Strict Mode start/stop/start 검증.
- reset은 새 sessionId로 버퍼와 캔들을 다시 만들고 정지 여부를 유지한다. 체결 표시 200개/보관 500개, 캔들 보관 240개. 버퍼 절단과 관계없이 모든 체결을 집계한다. 5초 초과 스케줄링 지연은 stale 표시 후 다음 틱부터 이어가며 backlog를 재생하지 않는다.
- `src/features/search/stock-search.tsx`: 이름/코드, combobox, 방향키/Enter/Escape, 빈 결과, 한글 IME 조합 중 Enter 방어. 검색 목록이 아닌 가격 변경을 aria-live로 읽지 않는다.
- `src/app/`, `components/layout/`, `features/market/components/`: 홈/상세, 공통 합성 표시, pause/resume/reset, 연결/오류/로딩/미지원 상태. Lightweight Charts 캔들+거래량, 10단계 호가, 최근 체결, 차트 대체 수치 표, resize/cleanup, 모바일 세로 배치, 시스템 폰트. 데이터 설명과 noindex는 출처 오인 방지를 위한 최소 구성이다.
- `tests/unit/*`, `tests/e2e/market.spec.ts`, `README.md`: 재현 가능한 검증과 실행법.

**버전 선정과 근거 (2026-09-30 확인)**

- 검증 런타임: Node **24.21.0 LTS**, npm **11.17.0**. OS 기본 Node 26.4.0을 전역 변경하지 않고 별도 작업 경로의 Node 24로 최종 재설치/검증했다.
- Next **16.3.7**, React/React DOM **19.3.0**, TypeScript **6.0.3**, ESLint **9.39.5**, eslint-config-next **16.3.7**, Vitest **5.0.2**, Playwright **1.63.0**, Zod **4.6.5**, Tailwind **4.3.3**, Lightweight Charts **5.2.1**. 직접 의존성은 정확한 버전으로 고정했다.
- [Next 공식 설치 문서](https://nextjs.org/docs/app/getting-started/installation), [Node LTS 목록](https://nodejs.org/en/about/previous-releases), [Vercel Node 지원](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)과 npm 실제 engines/peerDependencies를 대조했다. Next는 Node >=20.9, React 19를 허용하며 Vitest 5는 Node 24를 지원한다.
- ESLint 10.11.0은 Next 설정의 범위에는 들지만 설치된 eslint-plugin-react 7.37.5 / jsx-a11y 6.10.2가 ESLint 9까지만 지원했고 `getFilename` 오류를 재현했다. 호환 가능한 9.39.5로 고정했다. npm의 지원 종료 경고는 남아 있으며 향후 Next 플러그인 호환 버전 확인 후 올린다.
- 종목 이름/보통주 코드만 [삼성전자 공식 상장 정보](https://www.samsung.com/global/ir/stock-information/listing-Info/)에서 확인했다. 실시간 가격/공시/DART 고유번호 수집은 하지 않았다.
- 차트는 [공식 라이선스 안내](https://tradingview.github.io/lightweight-charts/docs)와 [v5.2.1 NOTICE](https://raw.githubusercontent.com/tradingview/lightweight-charts/v5.2.1/NOTICE)를 확인해 화면의 TradingView 링크/로고와 데이터 설명의 저작권 고지를 유지했다.

**실제로 실행한 검증**

| 명령/검사 | 결과 |
|---|---|
| `npm ci` (Node 24.21.0 / npm 11.17.0) | exit 0, lockfile 재설치 성공, npm audit 취약점 0건 보고. ESLint 지원 종료와 optional install-script 안내는 남음 |
| `npm run dev -- --port 3200` | Ready, 홈/상세 로컬 탐색, 상세 HTTP 200 확인 |
| `npm run typecheck` | exit 0, Next route type 생성 및 strict tsc 통과 |
| `npm run lint` | exit 0, 오류/경고 0 |
| `npm run test:unit` | exit 0, 3개 파일 32개 테스트 통과 |
| `npm run build` | exit 0, Next production build 성공 (홈/데이터 설명 정적, 상세 동적 경로) |
| `npm run test:e2e` | exit 0, production `npm run start -- --port 3100`에서 Chromium 데스크톱/모바일 총 4개 통과 |
| 금지 설정을 넣은 실제 build 3회 | public+가짜 KIS key / public+kis-private / VERCEL=1+bridge URL 모두 compile 이전 exit 1. 실제 키 미사용 |
| `npm ls --depth=0` | exit 0, 직접 의존성/설치 버전 확인 |
| `npx react-doctor@latest --verbose --scope changed` | Git 기준점이 없어 full scan으로 수행, 37개 파일/100점/진단 없음. 성능 측정 결과가 아님 |

Unit: seed 재현, quote/trade/candle/book 정합성, 15,000개 추가 합성 체결의 전체 집계와 버퍼 상한, 중복처럼 보이는 별개 체결, 오래된 분 bucket 거부, schema 오류, pause/resume/reset, listener 격리, 채널 필터, stale 후 회복, abort/history 입력, Strict Mode cleanup, 환경 경계, 검색/빈 결과/오류/로딩.

E2E: 이름/6자리 코드 키보드 검색 → 상세 → 네 영역 수치 일치 → 전체 값 정지 → reset 세션 교체 → 네트워크 offline에서도 재생. 페이지 왕복 시 세션/일시정지 유지, 미지원 종목, 데이터 출처, 모바일 페이지 넘침 없음, 컨테이너와 canvas 실제 resize. 외부 HTTP 요청과 pageerror가 0건임을 핵심 흐름에서 확인했다.

**브라우저/시각 확인 및 해결한 문제**

- ego-browser에서 홈/검색/상세/정지 조작과 DOM 상태 확인. ego의 CDP 캡처가 timeout 되어 Playwright의 실제 데스크톱/모바일 full-page PNG로 시각 검토를 완료했다. 캡처는 Git 제외 `test-results/`에 생성된다.
- 데스크톱 1440px, 모바일 Pixel 7 및 폭 축소에서 검증. 차트, 가격 표시, 잔량, 체결, 합성 안내가 표시되고 가로 넘침이 없다.
- Chromium `type=search`의 Escape 기본 지우기 동작이 onChange로 목록을 다시 여는 오류를 E2E에서 발견했다. preventDefault로 고치고 재실행 통과했다.
- UI 단위 테스트는 Next Link 프리페치 timer를 합성 scheduler로 잘못 세던 문제를 링크 adapter 분리로 고쳤으며 별도 provider 테스트와 실제 Strict Mode 테스트로 timer cleanup을 확인했다.
- Resize 테스트는 1328px max-width보다 큰 화면끼리 비교하면 폭이 유지되는 정상 동작을 실패로 잡았다. 실제 컨테이너 폭이 달라지는 1100px 이하로 줄여 canvas까지 검증했다.
- 주요 텍스트 토큰의 패널 배경 대비를 WCAG sRGB 공식으로 계산: 본문 14.88:1, 보조 8.30:1, 파랑 7.57:1, 빨강 7.63:1. 전체 접근성 인증이나 모든 조합 검증을 뜻하지 않는다.

**미실행/미구현 및 남은 제한**

- KIS 인증/REST/WS/계좌, DART 수집/원문 대조, Supabase 생성/DB/RLS, 원격 DB 변경, 배포, Git 변경 작업: 요청 범위 밖이며 실행하지 않음. 금융 원천 API 호출 없음.
- P1-B의 5~10종목, 관심종목 스트림, 배속, 탭 숨김 자동 일시정지, URL 기간/탭 상태는 미구현. 기본 반응형과 빈/오류 상태만 P1-A 접근성을 위해 포함.
- 재무/공시 화면 및 숫자는 제공하지 않음. 재무 기본 모드 이름 fixture가 실제 fixture 화면 구현을 뜻하지 않음.
- 일봉/실제 거래소 호가단위/휴장일을 재현하지 않으며 합성 1분 세션만 제공. 거래 방향은 unknown.
- 화면이 로드된 후의 시세 재생은 offline에서 동작한다. 처음 접속까지 offline을 보장하는 PWA/service worker는 없다.
- Safari/Firefox, 실제 보조공학 사용 검사, 30분 실행/100~1,000 events/s 부하 측정, 배포 환경 검증은 미실행. 빠른 생성기 테스트를 성능 개선 수치로 해석하지 않는다.
- ESLint 9 지원 종료 경고가 남음. 새 ESLint를 억지로 사용하거나 규칙을 끄지 않았으며 실제 lint는 통과함.

**다음 한 가지 작업:** 별도 요청에서 P1-B 지원 종목 확대와 공유 가상 시계/배속/숨김 탭 동작을 구현한다.

이 섹션에 최신 기록을 먼저 추가한다. 로그/캡처에 비밀정보가 없는지 확인하고, 과거 기록을 성공으로 소급 수정하지 않는다.

```text
날짜:
단계 / 요구사항 ID:
변경한 파일:
구현한 동작:
실행한 명령과 결과:
브라우저에서 확인한 화면/상태:
실행하지 못한 검증과 사유:
실제 API 호출 여부:
문서/설계 변경:
남은 위험:
다음 한 가지 작업:
```

## 9. 첫 작업

**P0 및 P1-A:** 키 없는 상태로 실행되는 웹 기반을 만들고, 홈 검색에서 종목 상세로 들어가 합성 현재가/캔들/호가/체결이 함께 동작하는 흐름을 완성한다. 시작 프롬프트는 `04_IMPLEMENTATION.md` 2절에 있다.
