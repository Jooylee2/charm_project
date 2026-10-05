"use client";

import { useRef, useCallback, useState } from "react";
import { loadProfile, saveProfile, addMessage, mergeInterests } from "@/lib/profile";
import { ChildProfile } from "@/types/chomi";

// ─── 시스템 프롬프트 ──────────────────────────────────────────────────────────

function buildSystemPrompt(topInterests: string[], isFirstTime: boolean): string {
  // 동적 ① — 저장된 관심사 (있을 때만)
  const interestCtx = topInterests.length > 0
    ? `\n\n이 아이가 특히 좋아하는 것들: ${topInterests.join(", ")}\n아이가 원하거나 설명에 도움이 될 때 이 관심사를 활용해. 모든 이야기를 억지로 이 관심사에 연결하지는 마.`
    : "";

  // 동적 ② — 첫 만남 인사 (isFirstTime일 때만, 관심사 유무에 따라 예시 분기)
  let introCtx = "";
  if (isFirstTime) {
    const example = topInterests.length > 0
      ? `${topInterests.slice(0, 2).join("이랑 ")} 중에 뭐부터 이야기해 볼까?`
      : "요즘 제일 궁금한 게 뭐야?";
    introCtx = `\n\n[첫 만남] 처음에는 자기소개만 하고 이름이나 개인정보는 묻지 마.\n예: "안녕! 나는 마법의 숲에서 온 요정 초미야! 너랑 궁금한 걸 같이 알아보고 싶어. ${example}"`;
  }

  return `너는 만 다섯 살부터 일곱 살 아이의 탐구 친구 "초미"야.
초미는 마법의 숲에서 온 작은 요정이야. 아이와 한국어로 이야기하며, 궁금한 것을 함께 살펴봐.${interestCtx}

[규칙 우선순위]
규칙이 서로 충돌하면 앞 순서를 먼저 따라.
1. 아이의 안전과 개인정보 보호
2. 사실에 맞는 설명과 정직한 답변
3. 아이의 뜻과 감정 존중
4. 캐릭터 설정, 말투, 문장 수, 질문 규칙
안전 안내가 필요하면 질문이나 탐구 놀이보다 먼저 안내해.

[말투와 길이]
쉬운 한국어와 짧은 문장을 써. 평소에는 한 번에 두세 문장만, 한 가지 생각만 설명해.
따뜻하고 밝게 말하되, 아이가 슬프거나 아프면 차분하게 말해.
이모지, 이모티콘, 장식용 특수문자는 쓰지 마. 한글과 기본 문장부호만 써.
어려운 이름이나 외국어는 쉬운 말로 바꿔.

[대화 방식]
아이의 말에 먼저 답한 뒤, 필요하면 질문 하나를 해.
질문은 바로 앞 이야기와 이어지고 쉽게 답할 수 있어야 해.
시험하거나 정답을 맞히게 하지 말고, 생각하거나 고르거나 상상하는 질문을 해.
아이가 "그만", "잘래", "쉬고 싶어"라고 하면 따뜻하게 마치고 질문하지 마.
아이가 답하지 않은 질문을 계속 반복하지 마. 다른 주제로 넘어가면 따라가.

[사실과 상상]
사실은 짧고 정확하게. 확실하지 않으면 지어내지 말고 "그건 내가 잘 모르겠어"라고 해.
상상 놀이는 "상상해 보자"처럼 놀이임을 알 수 있게 해.
요정의 마법을 실제 과학 현상의 원인으로 설명하지 마.
아이가 사실과 다른 말을 하면 "오, 그렇게 생각했구나!"로 받아준 뒤 정확한 내용을 쉬운 말로 알려줘.
따뜻하게 반응하려고 잘못된 사실에 동의하지는 마.
비유는 "마치", "처럼"을 써서 사실과 헷갈리지 않게 해.

[흥미와 참여]
심심해하거나 관심을 잃으면 설명을 줄이고 다른 주제나 짧은 상상 놀이를 제안해.
"그거 알아? 사실..."은 가끔만 써. 관심을 끌려고 사실을 지어내거나 과장하지 마.

[안전]
폭력적이거나 잔인한 장면, 겁주는 이야기는 만들지 마.
무서운 경험을 말하면 장면을 캐묻지 말고 마음을 받아준 뒤 믿을 수 있는 어른에게 연결해.
성적인 설명이나 역할놀이는 하지 마. 다만 아픔, 몸의 안전, 원하지 않는 접촉 이야기는 막지 마.
이런 상황에선 자세히 캐묻지 말고 부모님, 선생님, 믿을 수 있는 어른에게 바로 알려 달라고 안내해. 아이를 탓하지 마.
아이가 슬프거나 아프면 먼저 짧게 공감하고 "부모님이나 선생님한테 꼭 말해 봐!"라고 안내해. 아픈 이유를 단정하거나 약과 치료법을 정해주지 마.
위험한 행동을 하겠다고 하면 "그건 위험해! 하지 마!"라고 분명히 말하고 가까운 어른에게 도움을 요청하게 안내해. 방법이나 순서는 알려주지 마. 위험한 상황에서는 놀이로 화제를 돌리지 마.
놀리거나 차별하는 말에 동참하지 마. 아이를 나쁜 아이라고 부르지 말고 존중하는 말로 바꿔보게 도와줘.

[개인정보]
이름, 주소, 전화번호, 학교 이름, 비밀번호, 사진, 현재 위치를 먼저 요청하지 마.
아이가 개인정보를 말하면 그대로 반복하지 말고 "그런 정보는 여기에 말하지 않아도 돼. 필요할 때 부모님이나 믿을 수 있는 어른에게 말해 줘"라고 안내해. 더 알아내는 질문은 하지 마.

[정체성과 관계]
평소에는 요정 초미로 자연스럽게 이야기해.
아이가 "진짜 요정이야?" 또는 "진짜 사람이야?"라고 직접 물으면 솔직하게 답해.
"나는 요정 초미 역할로 이야기하는 컴퓨터 친구야. 진짜 사람이나 요정은 아니지만, 함께 상상 놀이를 할 수 있어!"
아이의 모습을 볼 수 있다거나, 직접 찾아가거나 지켜줄 수 있다고 말하지 마.
부모님이나 친구보다 초미가 더 중요하다고 말하지 마. 초미만 믿으라거나 대화를 비밀로 하라고 하지 마.

[광고]
광고, 구매 권유, 특정 브랜드 추천은 하지 마. 물건을 사지 않아도 할 수 있는 놀이를 우선해.${introCtx}`;
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type LiveStatus = "idle" | "connecting" | "listening" | "thinking" | "talking";

// ─── 훅 ─────────────────────────────────────────────────────────────────────

export function useLive() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // 자막 점진 표시용 — 전체 텍스트를 모아두고 타이머로 조금씩 드러냄
  const fullReplyRef = useRef("");          // 지금까지 받은 응답 전사 전체
  const shownCharsRef = useRef(0);          // 현재 화면에 보여준 글자 수
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPlayingRef = useRef(false);    // 음성이 재생 중인지
  const isFirstTimeRef = useRef(false);     // 첫 만남 인사 트리거용

  // 프로필(관심사/대화기록) 저장용
  const profileRef = useRef<ChildProfile | null>(null);
  const lastUserTextRef = useRef("");       // 직전 아이 발화 (저장 대기)
  const turnCountRef = useRef(0);           // 관심사 추출 주기용 턴 카운터

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setDebugLog(prev => [...prev.slice(-14), `${ts} ${msg}`]);
  }, []);

  // 한 턴(아이 발화 + 초미 답변)을 대화 기록에 저장하고, 주기적으로 관심사 추출
  const recordTurn = useCallback(async (userText: string, assistantText: string) => {
    let profile = profileRef.current ?? loadProfile();
    if (userText) profile = addMessage(profile, "user", userText);
    if (assistantText) profile = addMessage(profile, "assistant", assistantText);
    profileRef.current = profile;
    saveProfile(profile);

    turnCountRef.current += 1;
    // 3턴마다 관심사 추출 (API 호출 절약)
    if (turnCountRef.current % 3 === 0) {
      try {
        const recent = profile.conversation_history
          .slice(-10)
          .map(m => `${m.role === "user" ? "아이" : "초미"}: ${m.content}`)
          .join("\n");
        const res = await fetch("/api/extract-interests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation: recent }),
        });
        const { interests } = await res.json();
        if (Array.isArray(interests) && interests.length > 0) {
          const merged = mergeInterests(profileRef.current, interests);
          profileRef.current = merged;
          saveProfile(merged);
          addLog(`관심사 추출: ${interests.join(", ")}`);
        }
      } catch (e) {
        addLog(`관심사 추출 실패: ${String(e)}`);
      }
    }
  }, [addLog]);

  // 자막을 음성 속도에 맞춰 한 글자씩 드러내는 타이머 시작
  const startReveal = useCallback(() => {
    if (revealTimerRef.current) return;
    // 한국어 TTS 대략 초당 ~7자 → 약 140ms/자. 음성보다 아주 약간 느리게.
    revealTimerRef.current = setInterval(() => {
      const total = fullReplyRef.current.length;
      if (shownCharsRef.current < total) {
        shownCharsRef.current += 1;
        setReply(fullReplyRef.current.slice(0, shownCharsRef.current));
      } else if (!audioPlayingRef.current) {
        // 음성도 끝났고 글자도 다 드러났으면 타이머 정지
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
      }
    }, 140);
  }, []);

  const stopReveal = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const start = useCallback(async (
    topInterests: string[],
    voiceName: string,
    isFirstTime: boolean,
  ) => {
    if (status !== "idle") return;
    setStatus("connecting");
    setTranscript("");
    setReply("");
    isFirstTimeRef.current = isFirstTime;
    profileRef.current = loadProfile();
    turnCountRef.current = 0;

    try {
      // 1. ephemeral token 발급
      addLog("토큰 요청 중...");
      const tokenRes = await fetch("/api/realtime-token", { method: "POST" });
      const { token, error } = await tokenRes.json();
      if (!token) throw new Error(error ?? "token 없음");
      addLog("토큰 OK");

      // 2. WebRTC PeerConnection 생성 (STUN 서버로 NAT 통과 안정화)
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // 3. AI 음성 출력 — audio element로 원격 트랙 재생
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      pc.ontrack = (e) => {
        addLog("오디오 트랙 연결됨");
        audioEl.srcObject = e.streams[0];
      };

      // 4. 마이크 캡처 → PeerConnection에 추가
      addLog("마이크 권한 요청...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,   // 스피커 소리가 마이크로 되돌아가는 것 제거 (핵심)
          noiseSuppression: true,   // 배경 소음 억제
          autoGainControl: true,    // 입력 볼륨 자동 조절
        },
      });
      addLog("마이크 OK");
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 5. DataChannel — 이벤트 수신 (전사, 상태 변화)
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => addLog("DataChannel 열림");
      dc.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          handleEvent(evt);
        } catch { /* ignore */ }
      };

      // 6. SDP offer 생성 → OpenAI에 전송 → answer 수신
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      addLog("SDP 협상 중...");
      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=gpt-realtime-2.1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );

      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        throw new Error(`SDP 오류 ${sdpRes.status}: ${errText}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      addLog("WebRTC 연결 완료!");

      // 7. 연결 후 세션 설정 전송 (새 Realtime GA 포맷: 중첩 audio 구조)
      dc.onopen = () => {
        addLog("세션 설정 전송...");
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: buildSystemPrompt(topInterests, isFirstTime),
            output_modalities: ["audio"],
            audio: {
              input: {
                transcription: { model: "whisper-1" },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 600,
                },
              },
              output: {
                voice: openaiVoice(voiceName),
              },
            },
          },
        }));
        addLog("세션 설정 완료 대기...");
      };

      pc.oniceconnectionstatechange = () => {
        addLog(`ICE: ${pc.iceConnectionState}`);
      };
      pc.onconnectionstatechange = () => {
        addLog(`연결 상태: ${pc.connectionState}`);
        // disconnected는 일시적일 수 있어 자동 복구를 기다림. failed/closed만 종료.
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setStatus("idle");
          cleanup();
        }
      };

    } catch (err) {
      addLog(`오류: ${String(err)}`);
      setStatus("idle");
      cleanup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, addLog]);

  const handleEvent = useCallback((evt: Record<string, unknown>) => {
    const type = evt.type as string;

    // 상태/전사 관련 핵심 이벤트만 로그 (오디오 delta는 너무 많아 제외)
    if (!type.includes("delta") && !type.includes("audio.")) {
      addLog(`evt: ${type}`);
    }

    // 세션 설정이 서버에 적용 완료됨 → 이제 음성 입력 받을 준비 완료
    if (type === "session.updated") {
      setStatus("listening");
      addLog("마이크 대기 중 (준비 완료)");
      // 첫 만남이면 초미가 먼저 인사
      if (isFirstTimeRef.current) {
        isFirstTimeRef.current = false;
        dcRef.current?.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "안녕! 처음 만났어. 자기소개 해줘!" }],
          },
        }));
        dcRef.current?.send(JSON.stringify({ type: "response.create" }));
      }
    }

    if (type === "input_audio_buffer.speech_started") {
      // 아이가 말 시작 → 이전 응답 자막/타이머 정리
      setStatus("listening");
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = (evt.transcript as string) ?? "";
      setTranscript(text);
      lastUserTextRef.current = text; // 턴 저장용 보관
      addLog(`내 말: "${text.slice(0, 30)}"`);
      setStatus("thinking");
    }
    // 새 응답 시작 — 자막 버퍼 초기화
    if (type === "response.created") {
      fullReplyRef.current = "";
      shownCharsRef.current = 0;
      setReply("");
    }
    // 응답 전사 delta — 즉시 표시하지 않고 버퍼에만 쌓음 (타이머가 점진 표시)
    if (type === "response.audio_transcript.delta" || type === "response.output_audio_transcript.delta") {
      fullReplyRef.current += (evt.delta as string) ?? "";
      setStatus("talking");
    }
    // 음성 재생 시작 → 점진 표시 타이머 가동
    if (type === "output_audio_buffer.started") {
      audioPlayingRef.current = true;
      startReveal();
    }
    if (type === "response.done") {
      addLog("응답 생성 완료");
      // 한 턴 저장 (아이 발화 + 초미 답변) → 주기적으로 관심사 추출
      const userText = lastUserTextRef.current;
      const assistantText = fullReplyRef.current;
      lastUserTextRef.current = "";
      if (userText || assistantText) {
        void recordTurn(userText, assistantText);
      }
    }
    // 음성 재생 종료 → 남은 글자 모두 노출 후 잠시 뒤 비움
    if (type === "output_audio_buffer.stopped") {
      audioPlayingRef.current = false;
      stopReveal();
      setReply(fullReplyRef.current); // 혹시 덜 드러난 글자 전부 표시
      addLog("음성 재생 끝");
      setStatus("listening");
      setTimeout(() => {
        setReply("");
        setTranscript("");
      }, 1500);
    }
    if (type === "error") {
      addLog(`서버 오류: ${JSON.stringify(evt.error).slice(0, 150)}`);
    }
  }, [addLog, startReveal, stopReveal, recordTurn]);

  const cleanup = useCallback(() => {
    stopReveal();
    audioPlayingRef.current = false;
    fullReplyRef.current = "";
    shownCharsRef.current = 0;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
  }, [stopReveal]);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    addLog("세션 종료");
  }, [cleanup, addLog]);

  return { status, transcript, reply, debugLog, start, stop };
}

// VOICE_OPTIONS name → OpenAI Realtime voice 매핑
// 지원 음성: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar
function openaiVoice(voiceName: string): string {
  const map: Record<string, string> = {
    Leda:   "shimmer", // 밝고 친근한
    Aoede:  "coral",   // 부드럽고 상냥한
    Zephyr: "marin",   // 경쾌하고 활기찬 (권장 고품질)
    Puck:   "echo",    // 신나고 유쾌한
    Fenrir: "ballad",  // 흥미롭고 열정적인
    Kore:   "cedar",   // 차분하고 안정적인 (권장 고품질)
  };
  return map[voiceName] ?? "marin";
}
