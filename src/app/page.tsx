"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChomiAvatar from "@/components/ChomiAvatar";
import MicButton from "@/components/MicButton";
import { useSpeech } from "@/hooks/useSpeech";
import { AvatarMood, ConversationMessage } from "@/types/chomi";
import {
  loadProfile,
  saveProfile,
  addMessage,
  mergeInterests,
  getTopInterests,
} from "@/lib/profile";

type AppState = "idle" | "listening" | "thinking" | "talking";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [profile, setProfile] = useState(() => loadProfile());
  const { unlockAudio, startListening, stopListening, speak, stopSpeaking } = useSpeech();

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const avatarMood: AvatarMood = {
    idle: "idle",
    listening: "listening",
    thinking: "thinking",
    talking: "talking",
  }[appState] as AvatarMood;

  // 버튼 누르는 동안 녹음 → 떼면 서버 STT로 전송
  const handleMicPress = useCallback(() => {
    if (appState !== "idle") return;
    unlockAudio();
    stopSpeaking();
    setAppState("listening");
    setTranscript("");
    setReply("");

    startListening(
      (text) => { setTranscript(text); },
      (hasResult) => {
        if (hasResult) {
          setAppState("thinking");
        } else {
          setAppState("idle");
        }
      }
    );
  }, [appState, startListening, unlockAudio, stopSpeaking]);

  const handleMicRelease = useCallback(() => {
    if (appState === "listening") {
      stopListening(); // 녹음 중지 → onstop → 서버 STT 전송
    }
  }, [appState, stopListening]);

  // transcript가 생기고 thinking 상태이면 AI 호출
  useEffect(() => {
    if (appState !== "thinking" || !transcript) return;

    const askAI = async () => {
      try {
        const topInterests = getTopInterests(profile);
        const recentHistory: ConversationMessage[] = profile.conversation_history.slice(-10);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: transcript,
            history: recentHistory,
            topInterests,
          }),
        });

        const data = await res.json();
        const aiReply: string = data.reply ?? "어, 잘 못 들었어! 다시 말해줄래?";

        // 프로필에 대화 저장
        let updatedProfile = addMessage(profile, "user", transcript);
        updatedProfile = addMessage(updatedProfile, "assistant", aiReply);
        setProfile(updatedProfile);

        setReply(aiReply);
        setAppState("talking");

        speak(
          aiReply,
          () => setAppState("talking"),
          () => {
            setAppState("idle");
            const totalMessages = updatedProfile.conversation_history.length;
            if (totalMessages % 10 === 0) {
              extractInterests(updatedProfile.conversation_history.slice(-10));
            }
          }
        );
      } catch {
        setAppState("idle");
      }
    };

    askAI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, transcript]);

  const extractInterests = async (recentHistory: ConversationMessage[]) => {
    if (recentHistory.length < 2) return;
    const conversation = recentHistory
      .map((m) => `${m.role === "user" ? "아이" : "초미"}: ${m.content}`)
      .join("\n");

    try {
      const res = await fetch("/api/extract-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });
      const data = await res.json();
      if (data.interests?.length > 0) {
        setProfile((prev) => {
          const updated = mergeInterests(prev, data.interests);
          saveProfile(updated);
          return updated;
        });
      }
    } catch {
      // 관심사 추출 실패는 무시
    }
  };

  const stateLabel: Record<AppState, string> = {
    idle: "버튼을 누르고 말해봐!",
    listening: "듣고 있어...",
    thinking: "생각하는 중...",
    talking: "",
  };

  const topInterests = getTopInterests(profile, 3);

  // 별 위치/크기를 한 번만 고정 — Math.random()을 렌더 중에 쓰면 hydration 불일치 발생
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const seed = (i * 9301 + 49297) % 233280;
        const r = seed / 233280;
        const seed2 = (seed * 9301 + 49297) % 233280;
        const r2 = seed2 / 233280;
        const seed3 = (seed2 * 9301 + 49297) % 233280;
        const r3 = seed3 / 233280;
        const seed4 = (seed3 * 9301 + 49297) % 233280;
        const r4 = seed4 / 233280;
        return {
          size: r * 2 + 1,
          left: r2 * 100,
          top: r3 * 100,
          duration: r4 * 3 + 2,
          delay: ((i * 7919) % 233280) / 233280 * 3,
        };
      }),
    []
  );

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at top, #1e1b4b 0%, #0f0a1e 60%, #000 100%)",
      }}
    >
      {/* 배경 별 */}
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: s.size,
              height: s.size,
              left: `${s.left}%`,
              top: `${s.top}%`,
            }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: s.duration, repeat: Infinity, delay: s.delay }}
          />
        ))}
      </div>

      {/* 관심사 태그 (상단) */}
      <AnimatePresence>
        {topInterests.length > 0 && (
          <motion.div
            className="absolute top-8 flex gap-2 flex-wrap justify-center px-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {topInterests.map((interest) => (
              <span
                key={interest}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(124,58,237,0.3)",
                  border: "1px solid rgba(167,139,250,0.4)",
                  color: "#c4b5fd",
                }}
              >
                {interest}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 앱 타이틀 */}
      <motion.h1
        className="text-white/40 text-sm font-light tracking-[0.3em] mb-8 uppercase"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Chomi
      </motion.h1>

      {/* 아바타 */}
      <ChomiAvatar mood={avatarMood} />

      {/* 말풍선 */}
      <div className="mt-6 min-h-[80px] flex items-center justify-center px-8 max-w-sm w-full">
        <AnimatePresence mode="wait">
          {transcript && appState === "thinking" && (
            <motion.p
              key="transcript"
              className="text-white/50 text-sm text-center italic"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              "{transcript}"
            </motion.p>
          )}
          {reply && appState === "talking" && (
            <motion.div
              key="reply"
              className="rounded-2xl px-5 py-3 text-center text-white text-sm leading-relaxed"
              style={{
                background: "rgba(124,58,237,0.25)",
                border: "1px solid rgba(167,139,250,0.3)",
                backdropFilter: "blur(10px)",
              }}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {reply}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 상태 레이블 */}
      <motion.p
        className="mt-4 text-white/40 text-xs tracking-wider"
        animate={{ opacity: appState === "talking" ? 0 : 1 }}
      >
        {stateLabel[appState]}
      </motion.p>

      {/* 마이크 버튼 */}
      <div className="mt-8">
        <MicButton
          isListening={appState === "listening"}
          isDisabled={appState === "thinking" || appState === "talking"}
          onPress={handleMicPress}
          onRelease={handleMicRelease}
        />
      </div>
    </main>
  );
}
