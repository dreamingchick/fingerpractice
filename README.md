# 찰나의 해적

스마트폰 우선 타이밍 게임. 도전 시작 후 10초 카운트다운 종료 시점부터 첫 유효 터치까지의 시간을 밀리초로 기록합니다. 최솟값은 101ms입니다.

- 0초 이전과 0초 이후 101ms 미만의 터치는 무시하고 계속 진행. 미리 누른 입력은 기록하지 않고 101ms 이상에서 새로 누른 첫 터치만 인정, 화면 이탈은 취소. 동일 도전은 한 번만 등록.
- 단조 증가하는 performance.now()로 카운트다운 종료 시점을 정하고 프레임과 독립적으로 판정.
- D1 일간(한국 시간)·전체 랭킹, 참가자별 최고 기록, 동일 ms 공동 순위.
- 기기별 쿠키 참가 식별. 브라우저 데이터 삭제 시 참가 식별과 개인 기록이 바뀝니다.
- 서버 발급 도전과 경과 시간 검증을 사용하지만 클라이언트가 제출한 입력의 진실성은 보증하지 않습니다. 자동 클릭 방지와 보상 대회용 검증은 별도 고도화 대상입니다.
- 사이트 접근 범위는 호스팅 설정을 따릅니다. 최초 버전은 소유자 전용입니다.

## 검증
`node --test tests/timing.test.mjs`
`node node_modules/typescript/bin/tsc --noEmit`
`npm run build`

## 구조
`app/page.tsx`: 게임 UI와 상태 전이
`lib/timing.mjs`: 판정 함수
`app/api/game/route.ts`: 도전 발급·기록 제출·랭킹 API
`db/schema.ts`, `drizzle/`: 데이터베이스 스키마와 마이그레이션

101ms 미만의 기존 기록은 삭제하지 않고 랭킹과 기기 내 기록 표시에서 제외합니다. 서버도 101ms 미만의 신규 기록 제출을 거절합니다.

터치 원의 면적은 직전 버전의 70%, 최초 버전의 35%입니다. 지름은 직전 버전 대비 √0.7배로 축소하며 모바일/데스크톱 모두 동일 비율입니다. 보이는 원형 경계 안에서만 입력을 받습니다.


## Cloudflare 공용 랭킹 배포 (모바일 브라우저에서도 설정 가능)

게임에는 이미 D1 기반 `GET /api/game?period=today|all`,
`POST /api/game`(start, submit) API가 포함되어 있습니다.
실제 Cloudflare D1을 연결해야 다른 기기에서도 동일한 랭킹을 볼 수 있습니다.

1. Cloudflare 대시보드 → **Storage & databases → D1 SQL database**
   (메뉴 표기는 계정에 따라 다를 수 있습니다) → **Create database**.
   이름을 `fingerpractice-rankings`로 지정하고 생성한 DB의 **Database ID**를 복사합니다.
2. 생성된 D1 데이터베이스 → **Console**에서 다음 SQL을 실행합니다.
   이미 테이블이 있더라도 삭제하지 않도록 `IF NOT EXISTS`를 사용합니다.

   ```sql
   CREATE TABLE IF NOT EXISTS attempts (
     id TEXT PRIMARY KEY NOT NULL,
     player TEXT NOT NULL,
     started INTEGER NOT NULL,
     finished INTEGER,
     nickname TEXT,
     reaction INTEGER,
     day TEXT
   );
   CREATE INDEX IF NOT EXISTS attempts_player ON attempts(player, started);
   CREATE INDEX IF NOT EXISTS attempts_day ON attempts(day, reaction);
   ```

3. Cloudflare → **Workers & Pages** → GitHub에 연결된 `fingerpractice` Worker
   → **Settings → Build**로 이동합니다.
   - **Build variables**에 `D1_DATABASE_ID` = 1단계에서 복사한 실제 UUID를 설정합니다.
   - DB 이름을 다르게 생성했다면 `D1_DATABASE_NAME`도 실제 이름으로 설정합니다.
   - Worker 이름이 `fingerpractice`가 아니라면 `CF_WORKER_NAME`에 실제 Worker 이름을 설정합니다.
4. Git 연결을 `dreamingchick/fingerpractice`, 브랜치를 `main`으로 설정하고
   **Build command**: `npm run build`,
   **Deploy command**: `npm run deploy`,
   **Root directory**: 저장소 루트로 설정합니다.
   의존성 설치는 Cloudflare의 자동 설치 기능을 사용합니다.
5. 설정 저장 후 새 배포를 실행합니다. 배포된 Worker의 **Bindings**에서
   `DB`가 새 D1 데이터베이스와 연결된 것을 확인합니다.
   `D1_DATABASE_ID`는 **빌드 변수**이며 API 비밀번호가 아닙니다.
   소스 코드에는 개인 API 토큰을 추가하지 마세요.
6. 배포 주소에서 게임을 열어 기록을 등록하고, 다른 모바일 기기에서
   `오늘의 기록` 및 `전체 기록`에 같은 닉네임/기록이 나타나는지 확인합니다.
   응답 확인: `https://<배포주소>/api/game?period=all` (실제 주소로 변경).

### 오류 대응

- `D1 binding 'DB' references database '00000000-0000-4000-8000-000000000000'`:
  `D1_DATABASE_ID`가 **Cloudflare 빌드 변수**에 없거나,
  빌드 설정 변경 후 새로 빌드하지 않은 경우입니다.
- 게임은 열리지만 랭킹이 503: `DB` 바인딩 또는 `attempts` 테이블을 확인합니다.
- `npm run deploy` 명령은 빌드가 완료되어 `dist/server/wrangler.json`이
  생성된 뒤 실행해야 합니다.

> 주의: 랭킹은 클라이언트가 보고한 타이밍을 서버의 도전 시작 시각으로
> 검증하지만, 입력 자체의 진실성까지 증명하지는 않습니다.
> 보상을 지급하는 공식 대회용 부정행위 방지 기능은 별도로 필요합니다.
