"use client";

import { motion, AnimatePresence } from "framer-motion";

interface MicButtonProps {
  isListening: boolean;
  isDisabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}

export default function MicButton({ isListening, isDisabled, onPress, onRelease }: MicButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* 파동 링 */}
      <AnimatePresence>
        {isListening && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-violet-400"
                style={{ width: 80, height: 80 }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* 버튼 */}
      <motion.button
        onMouseDown={onPress}
        onMouseUp={onRelease}
        onTouchStart={onPress}
        onTouchEnd={onRelease}
        disabled={isDisabled}
        className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center select-none"
        style={{
          background: isListening
            ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
            : "linear-gradient(135deg, #4f46e5, #7c3aed)",
          boxShadow: isListening
            ? "0 0 30px rgba(124,58,237,0.8), 0 4px 20px rgba(0,0,0,0.4)"
            : "0 0 15px rgba(124,58,237,0.4), 0 4px 15px rgba(0,0,0,0.3)",
        }}
        animate={{ scale: isListening ? 1.1 : 1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
          {isListening ? (
            // 녹음 중 — 정사각형 stop 아이콘
            <rect x="6" y="6" width="12" height="12" rx="2" />
          ) : (
            // 마이크 아이콘
            <>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeWidth="2" stroke="white" fill="none" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
      </motion.button>
    </div>
  );
}
