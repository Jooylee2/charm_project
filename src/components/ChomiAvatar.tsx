"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AvatarMood } from "@/types/chomi";

interface ChomiAvatarProps {
  mood: AvatarMood;
}

const moodConfig: Record<AvatarMood, { eyeScale: number; mouthPath: string; glow: string; bodyColor: string }> = {
  idle:      { eyeScale: 1,    mouthPath: "M 38 58 Q 50 63 62 58", glow: "#a78bfa", bodyColor: "#7c3aed" },
  listening: { eyeScale: 1.2,  mouthPath: "M 38 58 Q 50 63 62 58", glow: "#60a5fa", bodyColor: "#2563eb" },
  thinking:  { eyeScale: 0.8,  mouthPath: "M 42 58 Q 50 60 58 58", glow: "#fbbf24", bodyColor: "#d97706" },
  talking:   { eyeScale: 1.1,  mouthPath: "M 36 56 Q 50 68 64 56", glow: "#34d399", bodyColor: "#059669" },
  happy:     { eyeScale: 1.3,  mouthPath: "M 34 54 Q 50 70 66 54", glow: "#f472b6", bodyColor: "#db2777" },
  curious:   { eyeScale: 1.25, mouthPath: "M 40 58 Q 50 65 60 58", glow: "#fb923c", bodyColor: "#ea580c" },
};

export default function ChomiAvatar({ mood }: ChomiAvatarProps) {
  const cfg = moodConfig[mood];

  return (
    <div className="relative flex items-center justify-center">
      {/* 글로우 효과 */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 200, height: 200, background: cfg.glow, filter: "blur(40px)", opacity: 0.4 }}
        animate={{ scale: mood === "talking" ? [1, 1.15, 1] : [1, 1.05, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 아바타 SVG */}
      <motion.svg
        width="160" height="160" viewBox="0 0 100 100"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* 몸통 */}
        <motion.circle
          cx="50" cy="55" r="28"
          animate={{ fill: cfg.bodyColor }}
          transition={{ duration: 0.4 }}
        />
        {/* 얼굴 */}
        <motion.circle cx="50" cy="44" r="24" fill="#fde68a" />

        {/* 왼쪽 눈 */}
        <motion.ellipse
          cx="41" cy="41" rx="4" ry="4"
          fill="#1e1b4b"
          animate={{ scaleY: mood === "thinking" ? 0.4 : cfg.eyeScale }}
          transition={{ duration: 0.3 }}
        />
        {/* 왼쪽 눈 하이라이트 */}
        <circle cx="42.5" cy="39.5" r="1.2" fill="white" />

        {/* 오른쪽 눈 */}
        <motion.ellipse
          cx="59" cy="41" rx="4" ry="4"
          fill="#1e1b4b"
          animate={{ scaleY: mood === "thinking" ? 0.4 : cfg.eyeScale }}
          transition={{ duration: 0.3 }}
        />
        {/* 오른쪽 눈 하이라이트 */}
        <circle cx="60.5" cy="39.5" r="1.2" fill="white" />

        {/* 입 — animate의 d 트윈은 브라우저 SVG 파서 오류를 유발하므로 직접 prop으로만 교체 */}
        <path
          d={cfg.mouthPath}
          fill="none"
          stroke="#92400e"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* 말할 때 입 열림 표현 */}
        <AnimatePresence>
          {mood === "talking" && (
            <motion.ellipse
              key="mouth-open"
              cx="50" cy="60" rx="6" ry="4"
              fill="#92400e"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 1, 0.5, 1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        {/* 볼터치 */}
        <circle cx="33" cy="48" r="5" fill="#fca5a5" opacity="0.6" />
        <circle cx="67" cy="48" r="5" fill="#fca5a5" opacity="0.6" />

        {/* 귀 */}
        <circle cx="26" cy="44" r="5" fill="#fde68a" />
        <circle cx="74" cy="44" r="5" fill="#fde68a" />

        {/* 생각중 말풍선 점 */}
        <AnimatePresence>
          {mood === "thinking" && (
            <motion.g key="thinking-dots">
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={43 + i * 7} cy="28" r="2.5"
                  fill={cfg.glow}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </motion.svg>
    </div>
  );
}
