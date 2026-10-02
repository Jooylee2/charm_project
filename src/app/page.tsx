"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChomiAvatar from "@/components/ChomiAvatar";
import MicButton from "@/components/MicButton";
import { useLive } from "@/hooks/useLive";
import { AvatarMood, VOICE_OPTIONS, VoiceName } from "@/types/chomi";
import { loadProfile, getTopInterests } from "@/lib/profile";
import { loadSettings, saveSettings } from "@/lib/settings";

export default function Home() {
  const { status, transcript, reply, start, stop } = useLive();

  const [settings, setSettings] = useState(() => loadSettings());
  const [showVoiceModal, setShowVoiceModal] = useState(false);

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
      start(topInterests, settings.voiceName, !settings.hasSeenIntro);
      if (!settings.hasSeenIntro) {
        const updated = saveSettings({ hasSeenIntro: true });
        setSettings(updated);
      }
    } else {
      stop();
    }
  }, [status, start, stop, topInterests, settings]);

  const handleVoiceSelect = useCallback((name: VoiceName) => {
    const updated = saveSettings({ voiceName: name });
    setSettings(updated);
    setShowVoiceModal(false);
  }, []);

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

  const selectedVoice = VOICE_OPTIONS.find(v => v.name === settings.voiceName) ?? VOICE_OPTIONS[0];

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

      {/* 설정 버튼 (우상단) */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowVoiceModal(true)}
          disabled={status !== "idle"}
          className="p-2 rounded-full transition-opacity"
          style={{
            background: "rgba(124,58,237,0.2)",
            border: "1px solid rgba(167,139,250,0.3)",
            opacity: status !== "idle" ? 0.4 : 1,
          }}
          aria-label="목소리 설정"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(196,181,253,0.9)" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
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

      {/* 현재 목소리 표시 */}
      {status === "idle" && (
        <motion.p
          className="mt-1 text-white/25 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          목소리: {selectedVoice.label} ({selectedVoice.desc})
        </motion.p>
      )}

      {/* 마이크 버튼 */}
      <div className="mt-8">
        <MicButton
          isListening={status === "listening"}
          isDisabled={status === "connecting"}
          onPress={handleMicPress}
          onRelease={() => {}}
        />
      </div>

      {/* 목소리 선택 모달 */}
      <AnimatePresence>
        {showVoiceModal && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowVoiceModal(false)}
          >
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} />
            <motion.div
              className="relative w-full max-w-sm rounded-3xl p-6"
              style={{
                background: "rgba(15,10,30,0.95)",
                border: "1px solid rgba(167,139,250,0.3)",
              }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-white text-base font-medium mb-4 text-center tracking-wide">
                초미 목소리 선택
              </h2>
              <div className="flex flex-col gap-2">
                {VOICE_OPTIONS.map((voice) => {
                  const isSelected = voice.name === settings.voiceName;
                  return (
                    <button
                      key={voice.name}
                      onClick={() => handleVoiceSelect(voice.name as VoiceName)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all"
                      style={{
                        background: isSelected ? "rgba(124,58,237,0.4)" : "rgba(124,58,237,0.1)",
                        border: `1px solid ${isSelected ? "rgba(167,139,250,0.7)" : "rgba(167,139,250,0.2)"}`,
                      }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: isSelected ? "#a78bfa" : "rgba(167,139,250,0.3)" }}
                      />
                      <div>
                        <p className="text-white text-sm font-medium">{voice.label}</p>
                        <p className="text-white/50 text-xs">{voice.desc}</p>
                      </div>
                      <span className="ml-auto text-white/30 text-xs">{voice.tone}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowVoiceModal(false)}
                className="mt-4 w-full py-2 rounded-2xl text-white/50 text-sm"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
