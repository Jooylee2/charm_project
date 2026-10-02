import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST() {
  try {
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        liveConnectConstraints: {
          model: "gemini-live-2.5-flash-preview",
        },
      },
    });
    return NextResponse.json({ token: token.name });
  } catch (err) {
    console.error("[live-token] 오류:", err);
    return NextResponse.json({ error: "token 발급 실패" }, { status: 500 });
  }
}
