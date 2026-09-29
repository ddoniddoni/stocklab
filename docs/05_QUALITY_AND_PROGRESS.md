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
| 기본 시세 | 5개 종목, 합성 100 events/s, 60초 | commit 횟수, main-thread long tasks, 메모리 |
| 높은 입력 | 합성 500/1,000 events/s, 각 60초 | 처리량, backlog, 집계 정합성, 입력 지연 |
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
| Next.js 앱 | P0 / P1-A / P1-B 구현 및 로컬 검증 완료 |
| 패키지 버전/Node 버전 선정 | Node 24.21.0 LTS / npm 11.17.0, 아래 작업 기록 참조 |
| 합성 시세 Provider | 5종목, 공유 시계/배속/숨김 정지/전체 초기화/URL 복원 |
| 실제 한투 키 발급/인증/수신 | 미실행 |
| DART 키/실제 수집/원문 대조 | 미실행 |
| Supabase 생성/migration/RLS | 미실행 |
| 테스트/lint/typecheck/build | unit 44개, Chromium E2E 10개, lint/typecheck/build 통과 |
| Vercel 배포 | 미실행 |
| Git Flow | main/develop 초기 기준. P0/P1-A/P1-B는 feature/p0-p1a-synthetic-market에서 관리하며 통합/릴리스는 미실행 |

### 7.2 단계 기록

| 단계 | 상태 | 완료 근거 | 남은 일 |
|---|---|---|---|
| P0 | done | 키 없는 npm ci/dev/typecheck/lint/unit/build 검증 | ESLint 9 호환성 제한 추적 |
| P1 | done | P1-A / P1-B 완료 및 로컬 검증 | 장시간/다중 브라우저 측정은 P6 |
| P1-A | done | 홈 검색 → 상세, 단일 합성 파이프라인, unit/E2E/브라우저 확인 | 없음 |
| P1-B | done | 5종목/선택 목록/공유 배속/visibility/URL, unit/E2E/시각 확인 | 실제 OS 백그라운드 동작 미검증 |
| P2 | not_started | 없음 | DART 파서와 실제 데이터 |
| P3 | not_started | 없음 | 비교/개인 로컬 기록 |
| P4 | not_started | 없음 | 공개 캐시와 모드 차단 |
| P5 | not_started | 없음 | 실제 한투 로컬 연동 |
| P6 | not_started | 없음 | 측정/접근성/릴리스 |
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

### 7.4 검증이 필요한 외부 항목

- 본인 한투 계정의 신청 조건과 허용 사용 목적
- 본인 계정의 최신 REST/WS 한도와 토큰 정책
- 실제 수신 프레임의 필드와 공식 샘플 commit SHA
- DART 인증키와 실제 지원 기업의 원문 대조
- Vercel/Supabase 실제 플랜과 사용량/권한 설정
- 후속 도입 라이브러리의 버전/라이선스와 ESLint 10 호환 플러그인

위 항목이 미확인이라고 전체 개발을 멈추지는 않는다. 키 없는 합성 UI, parser 테스트, 공개 차단 로직을 먼저 만들고 해당 연동만 미검증 상태로 남긴다.

## 8. 작업 종료 기록

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
