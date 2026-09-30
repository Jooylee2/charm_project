"use client";

import { useRef, useCallback } from "react";

export function useSpeech() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioPlayRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockRef = useRef<HTMLAudioElement | null>(null);

  // 버튼 클릭 시점(user gesture)에 오디오 언락
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioUnlockRef.current) audioUnlockRef.current = new Audio();
    const silent = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA";
    audioUnlockRef.current.src = silent;
    audioUnlockRef.current.play().catch(() => {});
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
