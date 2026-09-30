# Chomi (초미)

취학 전 아이(5~7세)가 AI 친구 "초미"와 **음성으로 대화하며 호기심과 탐구력을 기르는** 웹 앱입니다.
Meta Muse Charm에서 영감을 받은 미니멀한 다크 UI로, 화면에는 아바타와 마이크 버튼만 있습니다.

배포: https://charmproject.vercel.app

---

## 핵심 컨셉

- **음성 전용 인터페이스** — 아이가 글을 읽지 못해도 쓸 수 있게 버튼 하나로 말하고 듣습니다.
- **역질문으로 대화를 이어가기** — AI가 매 답변 끝에 되물어서 아이가 계속 생각하게 만듭니다.
- **관심사 기반 개인화** — 대화에서 아이의 관심사(공룡, 우주 등)를 뽑아 저장하고, 이후 설명할 때 그것으로 비유합니다.

---

## 대화 흐름

```
[마이크 버튼] 누름
  → unlockAudio() (AudioContext 깨우기)
  → STT 시작 (Web Speech API, 침묵 감지 시 자동 종료)
  → 인식된 텍스트를 /api/chat 으로 전송 (히스토리 + 관심사 함께)
  → Gemini 응답 수신
  → /api/tts 로 음성 합성 → AudioContext로 재생
  → 대화를 localStorage 프로필에 저장
  → 10턴마다 /api/extract-interests 로 관심사 추출
```

상태: `idle → listening → thinking → talking → idle`

---

## 프로젝트 구조

```
src/
├─ app/
│  ├─ page.tsx                     # 메인 UI + 상태 머신 + 대화 오케스트레이션
│  ├─ layout.tsx
│  ├─ globals.css
│  └─ api/
│     ├─ chat/route.ts             # Gemini 대화 (시스템 프롬프트 + 히스토리 + 관심사)
│     ├─ tts/route.ts              # Google Cloud Text-to-Speech
│     ├─ stt/route.ts              # Google Cloud Speech-to-Text (예비 서버 STT 경로)
│     └─ extract-interests/route.ts# 대화에서 관심사 JSON 추출
├─ components/
│  ├─ ChomiAvatar.tsx              # SVG 아바타 (mood별 애니메이션)
│  └─ MicButton.tsx                # 마이크 버튼 (리스닝 시 물결 애니메이션)
├─ hooks/
│  └─ useSpeech.ts                 # STT/TTS/오디오 언락 통합 훅
├─ lib/
│  └─ profile.ts                   # localStorage 프로필 (관심사·히스토리) 관리
└─ types/
   └─ chomi.ts                     # 공용 타입 정의
```

---

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| 프레임워크 | Next.js 16 (App Router) + TypeScript |
| 스타일 | Tailwind CSS + Framer Motion |
| AI 대화 | Google Gemini (`gemini-3.1-flash-lite`) |
| 음성 입력 (STT) | Web Speech API (브라우저 네이티브) |
| 음성 출력 (TTS) | Google Cloud Text-to-Speech (`ko-KR-Wavenet-A`) |
| 오디오 재생 | Web Audio API (`AudioContext`) |
| 상태 저장 | 브라우저 localStorage |
| 배포 | Vercel |

---

## AI 프롬프트 구성

`/api/chat` 의 시스템 프롬프트는 세 부분으로 구성됩니다.

### 1. 페르소나
> 너는 5~7세 아이의 탐구 친구 "초미"야. 항상 한국어로 대답해.

### 2. 7가지 규칙

| # | 규칙 | 의도 |
|---|------|------|
| 1 | 짧고 쉬운 단어, 2~3문장 이내 | 음성 대화라 길면 지루함 |
| 2 | **모든 답변 끝에 역질문** | 대화가 끊기지 않고 호기심 유지 (핵심) |
| 3 | 아이가 틀려도 부정하지 않고 함께 탐구 | 자신감·탐구심 보호 |
| 4 | 어려운 개념은 아이가 아는 것으로 비유 | 이해 돕기 |
| 5 | 흥미 잃을 것 같으면 신기한 사실로 환기 | 몰입 유지 |
| 6 | 따뜻하고 신나는 말투 | 정서적 친밀감 |
| 7 | 이모지·특수문자 금지 | TTS가 이모지를 읽는 문제 방지 |

### 3. 개인화 컨텍스트 (동적 주입)

localStorage에 쌓인 관심사를 프롬프트에 삽입합니다:

```
이 아이가 특히 좋아하는 것들: 공룡, 우주, 로봇
설명할 때 이것들을 비유로 적극 활용해.
```

### One-shot 예시

```
아이: "별은 왜 반짝여?"
초미: "별빛이 공기를 지나오다가 흔들리거든! 마치 수영장 바닥이
      흔들려 보이는 것처럼! 그런데 낮에는 별이 어디 갔을까?"
```
→ 짧게 + 비유 + 역질문을 한 번에 시연.

**파라미터:** `temperature: 1.0` (답변 다양성), `maxOutputTokens: 200` (짧은 답변).
응답 후 `stripEmoji()`로 혹시 남은 이모지를 한 번 더 제거합니다.

---

## 관심사 추출 & 개인화 사이클

1. 대화가 오갈 때마다 `profile.ts`가 히스토리를 localStorage에 저장 (최근 30개 유지).
2. **10턴마다** `/api/extract-interests`가 최근 대화를 분석해 관심사를 JSON으로 추출.
3. 관심사는 `{ count, last_seen }` 형태로 누적되며, 자주 언급될수록 `count` 증가.
4. 다음 대화부터 상위 관심사가 시스템 프롬프트에 주입되어 비유에 활용됨.
5. 상위 관심사는 화면 상단에 태그로도 표시됨.

---

## 모바일 오디오 세션 설계 (중요)

모바일 Chrome에서는 STT(마이크 입력)와 TTS(스피커 출력)가 오디오 세션을 공유해
`<audio>` 엘리먼트로 재생하면 **두 번째 대화부터 입력/출력이 충돌**하는 문제가 있습니다.

이를 해결하기 위해 **오디오 출력을 `<audio>` 엘리먼트가 아닌 단일 `AudioContext`로 통일**했습니다 (`useSpeech.ts`):

- 버튼 클릭(user gesture) 시 `AudioContext.resume()`으로 한 번 깨우면 계속 살아있음.
- TTS 오디오는 `decodeAudioData`로 디코드 후 **매 재생마다 새 `AudioBufferSourceNode`를 만들고 버림** → 엘리먼트 재사용 오염이 구조적으로 불가능.
- 입력 세션(Web Speech 마이크)과 출력 세션(AudioContext 스피커)이 분리되어 연속 대화가 안정적으로 동작.

---

## 로컬 실행

```bash
npm install
npm run dev
```

`.env.local` 에 다음 환경변수가 필요합니다:

```
GEMINI_API_KEY=...      # Google AI Studio / Gemini API 키
GOOGLE_TTS_API_KEY=...  # Google Cloud TTS(+STT) API 키
```

http://localhost:3000 에서 확인.

---

## 배포 (Vercel)

- `main` 브랜치에 push하면 Vercel이 자동 배포합니다.
- Vercel 프로젝트 설정에서 위 두 환경변수를 등록해야 합니다.
- Framework Preset은 **Next.js**로 설정.
