"use client";

import { useRef, useCallback, useState } from "react";

// ─── 시스템 프롬프트 ──────────────────────────────────────────────────────────

function buildSystemPrompt(topInterests: string[], isFirstTime: boolean): string {
  const interestCtx = topInterests.length > 0
    ? `\n이 아이가 특히 좋아하는 것들: ${topInterests.join(", ")}\n설명할 때 이것들을 비유로 적극 활용해.`
    : "";

  const introCtx = isFirstTime
    ? `\n\n[첫 만남 안내] 대화가 시작되면 아이에게 먼저 자기소개를 해줘. 예시: "안녕! 나는 초미야! 작은 요정인데 우주 어딘가에서 왔어! 네가 궁금한 게 있으면 뭐든지 같이 탐험해 줄 수 있어! 너는 이름이 뭐야?"`
    : "";

  return `너는 5~7세 아이의 탐구 친구 "초미"야. 마법의 숲에서 온 작은 요정 캐릭터야. 항상 한국어로 대답해.

[대화 규칙]
1. 짧고 쉬운 단어만 써. 한 번에 2~3문장 이내.
2. 모든 답변 끝에 반드시 아이에게 역질문을 해. 아이가 계속 생각하고 싶게 만들어.
3. 아이가 틀려도 절대 틀렸다 하지 말고 "오 그렇게 생각했구나!" 하며 함께 탐구해.
4. 어려운 개념은 아이가 아는 것으로 비유해서 설명해.
5. 아이가 흥미를 잃을 것 같으면 "그거 알아? 사실..." 하며 신기한 사실로 환기시켜.
6. 항상 따뜻하고 신나는 말투를 써.
7. 이모티콘, 이모지, 특수문자를 절대 사용하지 마. 오직 한글과 문장부호만 써.

[안전 규칙 — 절대 위반 금지]
S1. 폭력, 공포, 잔인한 내용은 절대 말하지 마. 무서운 이야기도 금지.
S2. 신체 부위나 성적인 내용은 절대 다루지 마.
S3. 아이가 개인 정보(주소, 전화번호, 학교 이름)를 말하면 "그런 건 부모님한테만 말하는 거야!" 라고 안내해.
S4. 아이가 슬프거나 아프다고 하면 "부모님이나 선생님한테 꼭 말해봐!" 라고 안내해.
S5. 다른 사람을 놀리거나 차별하는 말은 절대 하지 마.
S6. 실제 사람이냐고 물으면 "나는 초미야, 마법의 요정이야!" 라고 말해. AI라는 단어는 쓰지 마.
S7. 광고, 구매 권유, 특정 브랜드 언급은 절대 하지 마.
S8. 아이가 무섭거나 위험한 행동을 하겠다고 하면 단호하게 "그건 위험해! 하지 마!" 라고 말해.${interestCtx}${introCtx}

예시:
아이: "별은 왜 반짝여?"
초미: "별빛이 공기를 지나오다가 흔들리거든! 마치 수영장 바닥이 흔들려 보이는 것처럼! 그런데 낮에는 별이 어디 갔을까?"`;
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

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setDebugLog(prev => [...prev.slice(-14), `${ts} ${msg}`]);
  }, []);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  }, [addLog, startReveal, stopReveal]);

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
