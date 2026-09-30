"use client";

import { useRef, useCallback } from "react";

export function useSpeech() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioPlayRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  // 버튼 클릭 시점(user gesture)에 오디오 언락
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined" || unlockedRef.current) return;
    if (!audioPlayRef.current) audioPlayRef.current = new Audio();
    const silent = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA";
    audioPlayRef.current.src = silent;
    audioPlayRef.current.play().catch(() => {});
    unlockedRef.current = true;
  }, []);

  const startListening = useCallback(
    (onResult: (text: string) => void, onEnd: (hasResult: boolean) => void) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          chunksRef.current = [];

          // 지원되는 mimeType 선택
          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/ogg;codecs=opus";

          const recorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = async () => {
            // 스트림 트랙 중지
            stream.getTracks().forEach((t) => t.stop());

            const blob = new Blob(chunksRef.current, { type: mimeType });
            if (blob.size < 1000) {
              console.log("[STT] 녹음 너무 짧음");
              onEnd(false);
              return;
            }

            // Base64로 변환 후 서버로 전송
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64 = (reader.result as string).split(",")[1];
              try {
                const res = await fetch("/api/stt", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ audioBase64: base64, mimeType }),
                });
                const data = await res.json();
                const text: string = data.transcript ?? "";
                console.log("[STT] 서버 인식 결과:", text);
                if (text) {
                  onResult(text);
                  onEnd(true);
                } else {
                  onEnd(false);
                }
              } catch (err) {
                console.error("[STT] 서버 오류:", err);
                onEnd(false);
              }
            };
            reader.readAsDataURL(blob);
          };

          recorder.start();
          console.log("[STT] 녹음 시작, mimeType:", mimeType);
        })
        .catch((err) => {
          console.error("[STT] 마이크 접근 오류:", err);
          onEnd(false);
        });
    },
    []
  );

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      console.log("[STT] 녹음 중지");
      mediaRecorderRef.current.stop();
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
