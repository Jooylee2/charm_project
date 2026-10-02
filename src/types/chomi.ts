export interface Interest {
  count: number;
  last_seen: string;
}

export interface ChildProfile {
  interests: Record<string, Interest>;
  conversation_history: ConversationMessage[];
  personality_notes: string[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type AvatarMood = "idle" | "listening" | "thinking" | "talking" | "happy" | "curious";

export interface AppSettings {
  voiceName: string;
  hasSeenIntro: boolean;
}

export const VOICE_OPTIONS = [
  { name: "Leda",   label: "레다",   desc: "밝고 친근한 여성 목소리",    tone: "Youthful"    },
  { name: "Aoede",  label: "아오에데", desc: "부드럽고 상냥한 여성 목소리", tone: "Breezy"      },
  { name: "Zephyr", label: "제피르",  desc: "경쾌하고 활기찬 목소리",     tone: "Bright"      },
  { name: "Puck",   label: "퍽",     desc: "신나고 유쾌한 목소리",       tone: "Upbeat"      },
  { name: "Fenrir", label: "펜리르",  desc: "흥미롭고 열정적인 목소리",   tone: "Excitable"   },
  { name: "Kore",   label: "코레",   desc: "차분하고 안정적인 목소리",    tone: "Firm"        },
] as const;

export type VoiceName = typeof VOICE_OPTIONS[number]["name"];
