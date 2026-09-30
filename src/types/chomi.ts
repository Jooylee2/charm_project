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
