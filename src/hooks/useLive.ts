"use client";

import { useRef, useCallback, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { LIVE_MODEL } from "@/lib/liveModel";

// ─── 시스템 프롬프트 ──────────────────────────────────────────────────────────

function buildSystemPrompt(topInterests: string[], isFirstTime: boolean): string {
  const interestCtx = topInterests.length > 0
    ? `\n이 아이가 특히 좋아하는 것들: ${topInterests.join(", ")}\n설명할 �� 이것들을 비유로 적극 활용해.`
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

type LiveSession = {
  sendRealtimeInput: (input: { audio: { data: string; mimeType: string } }) => void;
  close: () => void;
};

type ServerMessage = {
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  inputTranscription?: { text: string };
  outputTranscription?: { text: string };
};

// ─── 훅 ─────────────────────────────────────────────────────────────────────

export function useLive() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setDebugLog(prev => [...prev.slice(-12), `${ts} ${msg}`]);
  }, []);

  const sessionRef = useRef<LiveSession | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const getCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const pcm16ToFloat32 = (pcm: ArrayBuffer): Float32Array => {
    const view = new DataView(pcm);
    const float = new Float32Array(view.byteLength / 2);
    for (let i = 0; i < float.length; i++) {
      float[i] = view.getInt16(i * 2, true) / 32768;
    }
    return float;
  };

  const float32ToPcm16 = (float: Float32Array): ArrayBuffer => {
    const buf = new ArrayBuffer(float.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float[i]));
      view.setInt16(i * 2, clamped * 32767, true);
    }
    return buf;
  };

  const playNext = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || playQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    setStatus("talking");

    const buf = playQueueRef.current.shift()!;
    const source = ctx.createBufferSource();
    currentSourceRef.current = source;
    source.buffer = buf;
    source.connect(ctx.destination);
    source.onended = () => {
      currentSourceRef.current = null;
      playNext();
    };
    source.start(0);
  }, []);

  const enqueueAudio = useCallback((pcmData: ArrayBuffer) => {
    const ctx = getCtx();
    const float32 = pcm16ToFloat32(pcmData);
    const audioBuf = ctx.createBuffer(1, float32.length, 24000);
    audioBuf.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0);
    playQueueRef.current.push(audioBuf);
    if (!isPlayingRef.current) playNext();
  }, [getCtx, playNext]);

  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null;
        currentSourceRef.current.stop();
      } catch { /* 이미 정지 */ }
      currentSourceRef.current = null;
    }
    playQueueRef.current = [];
    isPlayingRef.current = false;
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

    // 모바일: 사용자 제스처 컨텍스트 안에서 AudioContext를 미리 생성하고 resume
    const ctx = getCtx();
    await ctx.resume();
    addLog(`AudioCtx state: ${ctx.state}`);

    try {
      addLog("토큰 요청 중...");
      const tokenRes = await fetch("/api/live-token", { method: "POST" });
      const { token, error } = await tokenRes.json();
      if (error || !token) throw new Error(error ?? "token 없음");
      addLog("토큰 OK, Live 연결 중...");

      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1alpha" }, // ephemeral token은 v1alpha 전용
      });

      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildSystemPrompt(topInterests, isFirstTime),
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          inputAudioTranscription: {},  // 내 말 전사 활성화
          outputAudioTranscription: {}, // 초미 답변 전사 활성화
        },
        callbacks: {
          onopen: () => {
            addLog("연결 완료! 마이크 대기 중");
            setStatus("listening");
          },
          onmessage: (e) => {
            const msg = e.data as ServerMessage;

            if (msg.inputTranscription?.text) {
              addLog(`내 말: "${msg.inputTranscription.text.slice(0, 30)}"`);
              setTranscript(msg.inputTranscription.text);
              setStatus("thinking");
            }
            if (msg.outputTranscription?.text) {
              setReply(prev => prev + msg.outputTranscription!.text);
            }
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.data && part.inlineData?.mimeType?.includes("audio")) {
                  const pcm = Uint8Array.from(
                    atob(part.inlineData.data),
                    c => c.charCodeAt(0)
                  ).buffer;
                  addLog(`오디오 수신: ${pcm.byteLength}bytes ctx:${audioCtxRef.current?.state}`);
                  enqueueAudio(pcm);
                } else if (part.inlineData) {
                  addLog(`다른 파트: ${part.inlineData.mimeType}`);
                }
              }
            }
            if (msg.serverContent?.turnComplete) {
              addLog("턴 완료");
              if (!isPlayingRef.current) setStatus("listening");
            }
            if (msg.serverContent?.interrupted) {
              addLog("인터럽트");
              stopPlayback();
              setReply("");
              setStatus("listening");
            }
          },
          onerror: (e: unknown) => {
            const ev = e as { message?: string; type?: string };
            addLog(`오류: type=${ev?.type} msg=${ev?.message ?? String(e)}`);
            setStatus("idle");
          },
          onclose: (e: unknown) => {
            const ev = e as { code?: number; reason?: string };
            addLog(`종료: code=${ev?.code} reason=${ev?.reason ?? "(없음)"}`);
            setStatus("idle");
          },
        },
      });

      sessionRef.current = session as unknown as LiveSession;

      // 마이크 캡처 (16kHz PCM)
      const micCtx = new AudioContext({ sampleRate: 16000 });
      micCtxRef.current = micCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      addLog(`마이크 OK, 스트리밍 시작`);

      const micSource = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (ev) => {
        if (!sessionRef.current) return;
        const float32 = ev.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPcm16(float32);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16)));
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
        });
      };

      micSource.connect(processor);
      processor.connect(micCtx.destination);

    } catch (err) {
      addLog(`시작 오류: ${String(err)}`);
      setStatus("idle");
    }
  }, [status, enqueueAudio, stopPlayback]);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    micCtxRef.current?.close();
    micCtxRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    stopPlayback();
    setStatus("idle");
  }, [stopPlayback]);

  return { status, transcript, reply, debugLog, start, stop };
}
