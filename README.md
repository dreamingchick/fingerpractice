# 찰나의 해적

모바일 터치 기기 전용 타이밍 게임. 도전 시작 후 10초 카운트다운 종료 시점부터 첫 유효 터치까지의 시간을 밀리초로 기록합니다. 0ms도 유효한 기록입니다.

- 0초 이전 터치는 무시하고 계속 진행. 정확히 0초부터 새로 누른 첫 터치를 기록하며 최소 101ms 제한은 없습니다. 미리 누르고 있는 입력은 기록하지 않고, 화면 이탈은 취소합니다.
- 단조 증가하는 performance.now()로 카운트다운 종료 시점을 정하고 프레임과 독립적으로 판정.
- D1 일간(한국 시간)·전체 랭킹, 참가자별 최고 기록, 동일 ms 공동 순위.
- 기기별 쿠키 참가 식별. 브라우저 데이터 삭제 시 참가 식별과 개인 기록이 바뀝니다.
- 서버가 도전을 발급하고, 브라우저가 터치 직후 기록을 즉시 제출하면 서버 시간과 비교해 1회만 확정합니다. 이후 닉네임 등록 시 밀리초 기록은 수정할 수 없습니다. 쿠키별 도전 속도 및 1분당 발급 횟수도 제한합니다. 브라우저 입력 조작을 완전히 방지하지는 못합니다.
- 일반 PC에서 접속하면 게임 대신 '이 게임은 모바일에서만 플레이할 수 있습니다.' 안내를 표시합니다. PC의 게임/랭킹 API 요청은 403으로 차단합니다.

## 검증
`node --test tests/*.test.mjs`
`node node_modules/typescript/bin/tsc --noEmit`
`npm run build`

## 구조
`app/page.tsx`: 모바일 접속 판별, PC 경고 화면, 게임 UI와 상태 전이
`lib/mobile-access.mjs`: 모바일 플랫폼 및 터치 입력 판별
`lib/mobile-ranking.mjs`: 배포 후 D1 랭킹 초기화(기존 기록 삭제)
`lib/timing.mjs`: 판정 함수
`app/api/game/route.ts`: 도전 발급·기록 제출·랭킹 API
`db/schema.ts`, `drizzle/`: 데이터베이스 스키마와 마이그레이션

0~30000ms 범위의 정수 기록을 허용합니다. 이전에 101ms 미만이라는 이유로 가려졌던 기존 기록도 유효한 등록 기록이라면 랭킹에 표시됩니다. 0초 이전 입력은 언제나 무시됩니다.

터치 원의 면적은 직전 버전의 70%, 최초 버전의 35%입니다. 지름은 직전 버전 대비 √0.7배로 축소하며 모바일/데스크톱 모두 동일 비율입니다. 보이는 원형 경계 안에서만 입력을 받습니다.


## Cloudflare 공용 랭킹 배포 (모바일 브라우저에서도 설정 가능)

게임에는 이미 D1 기반 `GET /api/game?period=today|all`,
`POST /api/game`(start, hit, submit) API가 포함되어 있습니다. `hit`는 터치 직후 즉시 기록을 확정하고, `submit`은 검증된 기록에 닉네임만 붙입니다.
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


## 부정 기록 방지 정책 (v1.2)

- 10초 카운트다운 이전의 입력은 로컬에서 무시합니다. 0ms부터 인정하지만 음수·소수·30초 초과 값은 서버에서 거절합니다.
- 각 도전은 서버에 생성된 무작위 ID와 HttpOnly 참가자 쿠키로 묶입니다. 터치 결과는 즉시 서버에 전송하고, 서버가 기록을 한 번만 확정합니다.
- 서버는 도전 시작 이후 10초 + 제출된 반응 시간이 경과했는지 확인하며, 모바일 네트워크 지연에 최대 15초의 여유를 둡니다. 시간 창을 벗어나거나 이미 확정된 도전은 거절합니다.
- 닉네임은 서버가 기록을 확정한 뒤 60초 안에 한 번만 등록할 수 있습니다. 등록 요청으로 기록값을 변경할 수 없습니다.
- 같은 브라우저 식별자의 도전 발급은 1.5초 간격과 분당 12회로 제한합니다. 이 제한은 쿠키 변경이나 여러 접속을 완전히 막지는 못합니다.
- 0~100ms의 빠른 기록을 자동 부정 처리하지 않습니다. **완전히 예측 가능한 10초 카운트다운과 클라이언트 측 터치 판정만으로는 자동화·변조 입력의 진위성을 증명할 수 없습니다.** 공식 경쟁이나 상품 지급을 계획한다면 Cloudflare WAF/Turnstile, 이상 행동 분석, 독립적인 서버 챌린지 등을 추가로 설계해야 합니다.
- 기존 D1 `attempts` 스키마를 그대로 사용합니다. 데이터베이스 테이블 삭제 또는 재생성이 필요하지 않습니다.


## 모바일 전용 전환 및 랭킹 초기화 (v1.3)

- **모바일 전용:** Android 스마트폰·태블릿 및 iPhone·iPad의 터치 입력 기기에서 게임을 표시합니다. Windows/macOS/ChromeOS 등 일반 PC는 '이 게임은 모바일에서만 플레이할 수 있습니다.' 안내만 표시합니다.
- **서버 보호:** PC User-Agent를 사용하는 `GET /api/game`, `POST /api/game` 요청에는 HTTP 403을 반환하여 도전 생성, 기록 등록, 랭킹 API 이용을 제한합니다. 실제 터치 측정도 `pointerType === 'touch'`인 입력만 허용합니다.
- **랭킹 초기화:** 새 버전의 첫 정상 모바일 API 요청 시 D1에 `leaderboard_reset` 메타데이터가 만들어지고, 이전에 생성된 `attempts` 기록이 실제로 삭제됩니다. 이후 재배포·다른 Worker 인스턴스의 초기화로 새 기록이 다시 삭제되지 않도록 고정 초기화 시각을 사용합니다. 기존 랭킹과 미완료 도전 기록은 복구되지 않으므로 처음부터 새 순위가 시작됩니다.
- **기기별 최고 기록 초기화:** 이전 버전의 `zero-best`/`zero-recent`는 읽지 않고, 새 저장소 키 `zero-mobile-v1-best`/`zero-mobile-v1-recent`를 사용합니다. 닉네임은 유지합니다.
- 기존 `attempts` 테이블 구조는 유지합니다. 별도의 SQL 실행이나 D1 바인딩 재설정 없이 적용됩니다.
- **한계:** User-Agent 및 터치 가능 여부는 강력한 기기 인증이 아니므로, PC의 브라우저 개발자 도구나 요청 헤더 위조까지 완전히 막을 수 없습니다. 일부 iPadOS 브라우저의 '데스크톱 웹사이트 요청' 모드는 PC로 판별될 수 있습니다.
- **검수:** PC에서 경고 문구만 보이는지, PC의 `/api/game?period=all`이 403인지, 스마트폰에서 랭킹이 비어 있는 상태로 시작하고 새 기록 등록·공유가 정상인지 확인합니다.


## 수정 터치 패널 v3 (라이브 UI)

- 기존의 녹색 원형 터치 버튼 대신 투명 배경 WebP `public/crystal-touch-v3.webp`를 표시합니다.
- 그림 위의 흰색 말풍선 안에는 고정 그림 숫자를 덮는 **실시간 카운트다운 10→0**과 터치 성공 시의 **밀리초 반응 기록**이 표시됩니다.
- 새 터치 영역은 그림 너비와 같으며, 말풍선이 아닌 **수정과 샘 부분**(`top:28%; height:70%`)에서만 터치를 수락합니다.
- 모바일 실제 터치 입력(`pointerType === 'touch'`)에 한해 기존의 `hit(performance.now())` 판정을 이용합니다. 0초 이전은 무시하고, 0ms부터 허용합니다.
- 기존 Cloudflare Worker API, D1 데이터베이스 및 전체/일간 랭킹 데이터는 변경하지 않습니다.
- 검증: `node --test tests/*.test.mjs`, `pnpm exec tsc --noEmit`, `pnpm run build`.
