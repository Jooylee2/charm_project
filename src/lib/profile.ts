import { ChildProfile } from "@/types/chomi";

const STORAGE_KEY = "chomi_profile";

export function loadProfile(): ChildProfile {
  if (typeof window === "undefined") return emptyProfile();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyProfile();
  try {
    return JSON.parse(raw);
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile: ChildProfile): void {
  if (typeof window === "undefined") return;
  // 히스토리는 최근 30개만 유지
  const capped = {
    ...profile,
    conversation_history: profile.conversation_history.slice(-30),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
}

export function addMessage(
  profile: ChildProfile,
  role: "user" | "assistant",
  content: string
): ChildProfile {
  return {
    ...profile,
    conversation_history: [
      ...profile.conversation_history,
      { role, content, timestamp: new Date().toISOString() },
    ],
  };
}

export function mergeInterests(
  profile: ChildProfile,
  newInterests: string[]
): ChildProfile {
  const updated = { ...profile.interests };
  const today = new Date().toISOString().split("T")[0];
  for (const interest of newInterests) {
    const key = interest.trim();
    if (!key) continue;
    updated[key] = {
      count: (updated[key]?.count ?? 0) + 1,
      last_seen: today,
    };
  }
  return { ...profile, interests: updated };
}

export function getTopInterests(profile: ChildProfile, n = 5): string[] {
  return Object.entries(profile.interests)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, n)
    .map(([k]) => k);
}

function emptyProfile(): ChildProfile {
  return { interests: {}, conversation_history: [], personality_notes: [] };
}
