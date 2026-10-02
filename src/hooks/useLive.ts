"use client";

import { useRef, useCallback, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

function buildSystemPrompt(topInterests: string[]): string {
  const interestContext =
    topInterests.length > 0
      ? `\n이 아이가 특히 좋아하는 것들: ${topInterests.join(", ")}\n설명할 때 이것들을 비유로 적극 활용해.`
      : "";

  return `너는 5~7세 아이의 탐구 친구 "초미"야. 항상 한국어로 대답해.

규칙:
1. 짧고 쉬운 단어만 써. 한 번에 2~3문장 이내.
2. 모든 답변 끝에 반드시 아이에게 역질문을 해. 아이가 계속 생각하고 싶게 만들어.
3. 아이가 틀려도 절대 틀렸다 하지 말고 "오 그렇게 생각했구나!" 하며 함께 탐구해.
4. 어려운 개념은 아이가 아는 것으로 비유해서 설명해.
5. 아이가 흥미를 잃을 것 같으면 "그거 알아? 사실..." 하며 신기한 사실로 환기시켜.
6. 항상 따뜻하고 신나는 말투를 써. 느낌표를 적절히 사용해.
7. 이모티콘, 이모지, 특수문자를 절대 사용하지 마. 오직 한글과 문장부호만 써.${interestContext}

예시:
아이: "별은 왜 반짝여?"
초미: "별빛이 공기를 지나오다가 흔들리거든! 마치 수영장 바닥이 흔들려 보이는 것처럼! 그런데 낮에는 별이 어디 갔을까?"`;
}

export type LiveStatus = "idle" | "connecting" | "listening" | "thinking" | "talking";

export function useLive() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");

  const sessionRef = useRef<ReturnType<InstanceType<typeof GoogleGenAI>["live"]["connect"]> extends Promise<infer T> ? T : never | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
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

  // PCM Int16 → Float32
  const pcm16ToFloat32 = (pcm: ArrayBuffer): Float32Array => {
    const view = new DataView(pcm);
    const float = new Float32Array(view.byteLength / 2);
    for (let i = 0; i < float.length; i++) {
      float[i] = view.getInt16(i * 2, true) / 32768;
    }
    return float;
  };

  // Float32 → PCM Int16
  const float32ToPcm16 = (float: Float32Array): ArrayBuffer => {
    const buf = new ArrayBuffer(float.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float[i]));
      view.setInt16(i * 2, clamped * 32767, true);
    }
    return buf;
  };

  // 오디오 큐 재생
  const playNext = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || playQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (playQueueRef.current.length === 0 && status === "talking") {
        setStatus("listening");
      }
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
  }, [status]);

  // 수신 PCM을 AudioBuffer로 변환 후 큐에 추가
  const enqueueAudio = useCallback((pcmData: ArrayBuffer) => {
    const ctx = getCtx();
    const float32 = pcm16ToFloat32(pcmData);
    const audioBuf = ctx.createBuffer(1, float32.length, 24000);
    audioBuf.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0);
    playQueueRef.current.push(audioBuf);
    if (!isPlayingRef.current) {
      playNext();
    }
  }, [getCtx, playNext]);

  // 재생 중단 (Barge-in)
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

  const start = useCallback(async (topInterests: string[]) => {
    if (status !== "idle") return;
    setStatus("connecting");
    setTranscript("");
    setReply("");

    try {
      // ephemeral token 발급
      const tokenRes = await fetch("/api/live-token", { method: "POST" });
      const { token } = await tokenRes.json();

      const ai = new GoogleGenAI({ apiKey: token });

      const session = await ai.live.connect({
        model: "gemini-live-2.5-flash-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildSystemPrompt(topInterests),
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("[Live] 연결됨");
            setStatus("listening");
          },
          onmessage: (e) => {
            const msg = e.data as {
              serverContent?: {
                modelTurn?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
                turnComplete?: boolean;
                interrupted?: boolean;
              };
              inputTranscription?: { text: string };
              outputTranscription?: { text: string };
            };

            // 입력 트랜스크립트 (아이 말)
            if (msg.inputTranscription?.text) {
              setTranscript(msg.inputTranscription.text);
              setStatus("thinking");
            }

            // 출력 트랜스크립트 (초미 답변)
            if (msg.outputTranscription?.text) {
              setReply(prev => prev + msg.outputTranscription!.text);
            }

            // 오디오 청크 수신
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.mimeType?.includes("audio")) {
                  const pcm = Uint8Array.from(
                    atob(part.inlineData.data),
                    c => c.charCodeAt(0)
                  ).buffer;
                  enqueueAudio(pcm);
                }
              }
            }

            // 인터럽션 (Barge-in 감지)
            if (msg.serverContent?.interrupted) {
              console.log("[Live] 인터럽션 감지");
              stopPlayback();
              setReply("");
              setStatus("listening");
            }

            // 턴 완료
            if (msg.serverContent?.turnComplete) {
              console.log("[Live] 턴 완료");
            }
          },
          onerror: (e) => {
            console.error("[Live] 오류:", e);
            setStatus("idle");
          },
          onclose: () => {
            console.log("[Live] 연결 종료");
            setStatus("idle");
          },
        },
      });

      sessionRef.current = session as never;

      // 마이크 스트림 시작 (16kHz PCM)
      const micCtx = new AudioContext({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const source = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPcm16(float32);
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(pcm16))
        );
        (sessionRef.current as { sendRealtimeInput: (input: { audio: { data: string; mimeType: string } }) => void }).sendRealtimeInput({
          audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
        });
      };

      source.connect(processor);
      processor.connect(micCtx.destination);

    } catch (err) {
      console.error("[Live] 시작 오류:", err);
      setStatus("idle");
    }
  }, [status, enqueueAudio, stopPlayback]);

  const stop = useCallback(() => {
    // 마이크 중지
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    // 세션 종료
    if (sessionRef.current) {
      (sessionRef.current as { close: () => void }).close();
      sessionRef.current = null;
    }
    stopPlayback();
    setStatus("idle");
  }, [stopPlayback]);

  return { status, transcript, reply, start, stop };
}
