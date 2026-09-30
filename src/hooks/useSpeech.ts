"use client";

import { useRef, useCallback } from "react";

export function useSpeech() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

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
    (text: string, onStart?: () => void, onEnd?: () => void) => {
      if (typeof window === "undefined") return;
      const synth = window.speechSynthesis;
      synthRef.current = synth;
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ko-KR";
      utter.rate = 0.9;
      utter.pitch = 1.3;

      // 아이 친화적 목소리 선택 시도
      const voices = synth.getVoices();
      const koreanVoice = voices.find(
        (v) => v.lang.startsWith("ko") && v.name.toLowerCase().includes("female")
      ) ?? voices.find((v) => v.lang.startsWith("ko"));
      if (koreanVoice) utter.voice = koreanVoice;

      utter.onstart = () => onStart?.();
      utter.onend = () => onEnd?.();
      synth.speak(utter);
    },
    []
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
  }, []);

  return { startListening, stopListening, speak, stopSpeaking };
}
