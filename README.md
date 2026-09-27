# Habit Check

습관 체크와 오늘의 기도에 집중하는 모바일 웹앱. 같은 Google 계정으로 Habit Garden의 기존 Firebase 데이터를 사용합니다.

## 실행

Node.js 22 이상과 pnpm을 사용합니다. 검증 환경은 Node 24.19 / pnpm 11.19입니다.

```sh
pnpm install --frozen-lockfile
pnpm dev --port 5174
```

- 화면 미리보기: `http://127.0.0.1:5174/habit-check/?demo=1`
- 실제 로그인 화면: `http://127.0.0.1:5174/habit-check/`
- `?demo=1`은 가상 데이터 전용이며 새로고침하면 초기화됩니다. 실제 습관·기도를 등록하지 않습니다.
- 실제 연결은 `.env.example`을 `.env.local`로 복사하고 기존 Habit Garden Firebase 웹 설정 네 항목을 채웁니다. 환경 파일은 Git에서 제외됩니다.
- Google 로그인은 기존과 같은 계정을 선택합니다. 로컬 도메인이 Firebase Auth 승인 도메인에 없으면 관리자 설정이 필요합니다. 앱은 팝업 실패 시 재시도를 안내하며 무한 리디렉션을 하지 않습니다.

## 사용자 동작

- 현재 시간대가 맨 위에 펼쳐집니다. 나머지 시간대와 언제든 목록은 눌러 펼칩니다. 항목 내부 순서는 기존 순서를 유지합니다.
- 체크형은 완료·취소, 보조 옵션은 안 했음·건너뜀입니다. 점수형은 1–5점을 그대로 저장합니다.
- 하루 마감은 진입 시점의 미기록 항목을 모읍니다. 입력해도 행이 사라지지 않습니다. 다시 진입하면 남은 미기록을 새로 모읍니다.
- 오늘·어제를 수정할 수 있습니다. 날짜는 한국 시간 새벽 4시 기준이므로 자정 직후에는 전날 날짜가 표시됩니다.
- 기도는 기존 오늘의 계획을 사용합니다. 전체 관리에서 검색·추가·수정·응답·고정·삭제·잠든 기도 깨우기가 가능합니다.
- 오프라인 기록은 Firebase의 로컬 캐시에 대기하고 연결되면 전송합니다. 캐시가 없는 항목을 오프라인에서 새로 불러올 수는 없습니다. 새 기도 계획 확정은 온라인에서만 합니다.
- 두 앱에서 같은 항목을 동시에 수정하면 마지막으로 서버에 반영된 쓰기가 적용됩니다. 저장·동기화 대기 상태를 구분해 보여줍니다.

## 데이터 계약

`users/{uid}` 아래의 `habits`, `prayers`, `settings/main`, `days/{date}`, 날짜별 `habitChecks`와 `prayerChecks`를 사용합니다. 사용자 UID를 고정하지 않으며 인증 계정의 UID만 사용합니다.

- 체크형 `score=0|1`, 점수형 `1..5`, 건너뜀 `null`, 기록 취소는 체크 문서 삭제입니다.
- 점수형 달성 기준은 3점입니다. 습관의 당시 정보를 `habitSnapshot`에 저장합니다. 점수 수정 시 기존 note/mood/tags 등 다른 필드는 merge로 보존합니다. 기록 취소는 해당 기록 문서 전체를 삭제합니다.
- 기도 계획은 트랜잭션으로 최초 한 번 확정하며 빈 계획도 확정 상태로 취급합니다. 기존 extraIds 및 day 문서의 다른 필드를 보존합니다.
- 기도 횟수·스트릭·응답 집계는 기존 Cloud Functions가 관리합니다. 클라이언트에서 중복 집계하거나 체크 취소 시 통계를 수동으로 되돌리지 않습니다.
- Firebase 앱 이름과 서비스 워커 범위를 Habit Garden과 분리합니다. PWA 범위는 `/habit-check/`, 캐시는 앱 정적 파일만 포함합니다. Firestore의 인증 사용자별 로컬 데이터 캐시는 SDK가 관리합니다.
- 백엔드 API, 운영 Firestore 규칙, 운영 함수, 기존 계정 데이터 구조는 변경하지 않았습니다.

동기화 기준 소스: [habit-garden d56d832](https://github.com/JonathanBlackDoctor/habit-garden/tree/d56d8328b2f771dd1a5739aac392879ac6dd10c4). `src/rotation.ts`는 해당 커밋의 `shared/prayerRotation.ts`를 가져와 타입 import와 포맷만 변경했습니다.

## 검증

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser
```

브라우저 테스트는 5174의 개발 서버와 설치된 Edge를 사용합니다. 다른 환경은 `BROWSER_CHANNEL=chrome` 또는 Playwright에 설치한 Chromium 채널을 지정합니다. 화면 산출물은 Git에서 제외된 `test-results/`에 저장합니다.

Firebase 통합 테스트에는 Java 21 이상이 필요합니다.

```sh
pnpm test:emulators
```

에뮬레이터를 이미 실행했다면 `pnpm test:integration`을 사용합니다. 테스트 프로젝트는 `demo-habit-check`, Auth 9199 / Firestore 8188입니다. `tests/firestore.rules`는 소유자 격리 검증 전용 규칙이며 운영에 배포하지 않습니다.

브라우저에서 실제 SDK·인증 에뮬레이터까지 검증하려면 다음 서버도 실행합니다.

```powershell
$env:VITE_USE_EMULATORS='true'
pnpm dev --port 5175
```

다른 터미널에서 `pnpm test:browser:integration`을 실행합니다. 가상 이메일 계정을 생성하며 실제 계정에는 접근하지 않습니다. `tests/browser-fixture.ts`는 에뮬레이터 모드와 demo 프로젝트를 모두 검사하며 프로덕션 빌드에 포함되지 않습니다.

- `node tests/date-ui.cjs`: 5174 서버에서 새벽 4시 전환·어제 기록 보존·320px 터치 영역 검증.
- `pnpm preview --port 4174` 실행 후 `node tests/pwa.cjs`: 프로덕션 빌드·서비스 워커 범위·정적 캐시·오프라인 재접속 검증.

## 전달 상태

로컬 구현 및 에뮬레이터 검증 완료. 원격 push, 공개, GitHub Pages 배포는 수행하지 않았습니다. 실제 Google 계정의 운영 로그인과 실제 휴대폰 설치·사용 확인은 남아 있습니다. 자세한 결과는 `QA.md`를 참고하세요.
