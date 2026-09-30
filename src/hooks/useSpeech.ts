"use client";

import { useRef, useCallback } from "react";

export function useSpeech() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const audioUnlockRef = useRef<HTMLAudioElement | null>(null); // unlock 전용
  const audioPlayRef = useRef<HTMLAudioElement | null>(null);   // TTS 재생 전용

  // 모바일 오디오 언락 — 버튼 클릭 시점(user gesture)에 호출
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioUnlockRef.current) {
      audioUnlockRef.current = new Audio();
    }
    if (!audioPlayRef.current) {
      audioPlayRef.current = new Audio();
    }
    // 무음 재생으로 두 Audio 객체 모두 활성화
    const silent = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA";
    audioUnlockRef.current.src = silent;
    audioUnlockRef.current.play().catch(() => {});
    audioPlayRef.current.src = silent;
    audioPlayRef.current.play().catch(() => {});
  }, []);

  const startListening = useCallback(
    (onResult: (text: string) => void, onEnd: (hasResult: boolean) => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        alert("이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요!");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "ko-KR";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let gotResult = false;

      recognition.onstart = () => console.log("[STT] 녹음 시작");
      recognition.onspeechstart = () => console.log("[STT] 음성 감지됨");
      recognition.onspeechend = () => console.log("[STT] 음성 종료");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        console.log("[STT] 인식 결과:", text);
        gotResult = true;
        onResult(text);
      };

      recognition.onend = () => {
        console.log("[STT] recognition.onend 호출, hasResult:", gotResult);
        onEnd(gotResult);
      };
      recognition.onerror = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("[STT] 오류:", e.error, e.message);
        onEnd(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    []
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
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

        // TTS 전용 Audio 객체 재사용
        if (!audioPlayRef.current) audioPlayRef.current = new Audio();
        const audio = audioPlayRef.current;
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audio.src = `data:audio/mp3;base64,${data.audioContent}`;
        audio.load();

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            console.log("[TTS] 재생 완료");
            resolve();
          };
          audio.onerror = () => {
            console.error("[TTS] 재생 오류");
            resolve();
          };
          audio.play().catch(() => resolve());
        });

        // 오디오 세션 완전 해제 — 모바일에서 마이크 재사용을 위해 필요
        audio.onended = null;
        audio.onerror = null;
        audio.src = "";
        audio.load();

        onEnd?.();
      } catch (err) {
        console.error("[TTS] 오류:", err);
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
