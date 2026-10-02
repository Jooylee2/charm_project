"use client";

import { useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChomiAvatar from "@/components/ChomiAvatar";
import MicButton from "@/components/MicButton";
import { useLive } from "@/hooks/useLive";
import { AvatarMood } from "@/types/chomi";
import { loadProfile, getTopInterests } from "@/lib/profile";

export default function Home() {
  const { status, transcript, reply, start, stop } = useLive();
  const profile = loadProfile();
  const topInterests = getTopInterests(profile, 3);

  const avatarMood: AvatarMood = {
    idle: "idle",
    connecting: "thinking",
    listening: "listening",
    thinking: "thinking",
    talking: "talking",
  }[status] as AvatarMood;

  const handleMicPress = useCallback(() => {
    if (status === "idle") {
      start(topInterests);
    } else {
      stop();
    }
  }, [status, start, stop, topInterests]);

  // 페이지 언마운트 시 세션 정리
  useEffect(() => {
    return () => { stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateLabel: Record<string, string> = {
    idle: "버튼을 눌러서 초미와 대화해봐!",
    connecting: "연결 중...",
    listening: "듣고 있어! 말해봐!",
    thinking: "생각하는 중...",
    talking: "",
  };

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
            style={{ width: s.size, height: s.size, left: `${s.left}%`, top: `${s.top}%` }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: s.duration, repeat: Infinity, delay: s.delay }}
          />
        ))}
      </div>

      {/* 관심사 태그 */}
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

      {/* 타이틀 */}
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
          {transcript && (status === "thinking" || status === "talking") && (
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
          {reply && status === "talking" && (
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
        animate={{ opacity: status === "talking" ? 0 : 1 }}
      >
        {stateLabel[status]}
      </motion.p>

      {/* 마이크 버튼 — idle이면 시작, 그 외엔 종료 */}
      <div className="mt-8">
        <MicButton
          isListening={status === "listening"}
          isDisabled={status === "connecting"}
          onPress={handleMicPress}
          onRelease={() => {}}
        />
      </div>
    </main>
  );
}
