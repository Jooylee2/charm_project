"use client";

import { useRef, useCallback } from "react";

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => SpeechRecognitionType;
  webkitSpeechRecognition?: new () => SpeechRecognitionType;
  webkitAudioContext?: typeof AudioContext;
};

export function useSpeech() {
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // AudioContext를 lazy 생성 후 반환 — 출력 세션을 단일 경로로 통일
  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext || (window as WindowWithSpeech).webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  }, []);

  // 버튼 클릭 시점(user gesture)에 AudioContext를 깨움 — 이후 계속 살아있음
  const unlockAudio = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }, [getCtx]);

  const startListening = useCallback(
    (onResult: (text: string) => void, onEnd: (hasResult: boolean) => void) => {
      if (typeof window === "undefined") return;
      const w = window as WindowWithSpeech;
      const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error("[STT] SpeechRecognition 미지원");
        onEnd(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "ko-KR";
      recognition.continuous = false;
      recognition.interimResults = false;

      let hasResult = false;

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const text = e.results[0][0].transcript;
        console.log("[STT] 인식 결과:", text);
        hasResult = true;
        onResult(text);
      };

      recognition.onend = () => {
        console.log("[STT] recognition.onend 호출, hasResult:", hasResult);
        recognitionRef.current = null;
        onEnd(hasResult);
      };

      recognition.onerror = (e: { error: string }) => {
        console.error("[STT] 오류:", e.error);
        recognitionRef.current = null;
        onEnd(false);
      };

      recognition.start();
      console.log("[STT] 녹음 시작");
    },
    []
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const speak = useCallback(
    async (text: string, onStart?: () => void, onEnd?: () => void) => {
      if (typeof window === "undefined") return;
      const ctx = getCtx();
      if (!ctx) {
        onEnd?.();
        return;
      }
      try {
        onStart?.();

        // 모바일에서 STT 후 suspended 될 수 있으므로 매번 resume 보장
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!data.audioContent) throw new Error("No audio");

        // base64 → ArrayBuffer
        const binary = atob(data.audioContent);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // Web Audio로 디코드 후 새 BufferSource로 재생 (매번 새로 만들고 버림)
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

        await new Promise<void>((resolve) => {
          const source = ctx.createBufferSource();
          currentSourceRef.current = source;
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => {
            console.log("[TTS] 재생 완료");
            currentSourceRef.current = null;
            resolve();
          };
          source.start(0);
        });
      } catch (err) {
        console.error("[TTS] 오류:", err);
      } finally {
        onEnd?.();
      }
    },
    [getCtx]
  );

  const stopSpeaking = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null;
        currentSourceRef.current.stop();
      } catch {
        // 이미 정지된 경우 무시
      }
      currentSourceRef.current = null;
    }
  }, []);

  return { unlockAudio, startListening, stopListening, speak, stopSpeaking };
}
