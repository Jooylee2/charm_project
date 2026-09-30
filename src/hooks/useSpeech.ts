"use client";

import { useRef, useCallback } from "react";

export function useSpeech() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioPlayRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 버튼 클릭 시점(user gesture)에 AudioContext로 언락
  // AudioContext는 TTS용 Audio 객체와 완전히 분리된 세션을 사용
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    // 무음 버퍼 재생으로 AudioContext 활성화
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }, []);

  const startListening = useCallback(
    (onResult: (text: string) => void, onEnd: (hasResult: boolean) => void) => {
      if (typeof window === "undefined") return;
      const SpeechRecognition =
        (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
        (window as Window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
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

      recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        console.log("[STT] 인식 결과:", text);
        hasResult = true;
        onResult(text);
      };

      recognition.onend = () => {
        console.log("[STT] recognition.onend 호출, hasResult:", hasResult);
        onEnd(hasResult);
      };

      recognition.onerror = (e) => {
        console.error("[STT] 오류:", e.error);
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
      try {
        onStart?.();
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!data.audioContent) throw new Error("No audio");

        if (!audioPlayRef.current) audioPlayRef.current = new Audio();
        const audio = audioPlayRef.current;
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audio.src = `data:audio/mp3;base64,${data.audioContent}`;
        audio.load();

        await new Promise<void>((resolve) => {
          audio.onended = () => { console.log("[TTS] 재생 완료"); resolve(); };
          audio.onerror = () => { console.error("[TTS] 재생 오류"); resolve(); };
          audio.play().catch(() => resolve());
        });

        audio.onended = null;
        audio.onerror = null;
        audio.src = "";
        audio.load();
      } catch (err) {
        console.error("[TTS] 오류:", err);
      } finally {
        onEnd?.();
      }
    },
    []
  );

  const stopSpeaking = useCallback(() => {
    if (audioPlayRef.current) {
      audioPlayRef.current.pause();
      audioPlayRef.current.onended = null;
      audioPlayRef.current.onerror = null;
    }
  }, []);

  return { unlockAudio, startListening, stopListening, speak, stopSpeaking };
}
