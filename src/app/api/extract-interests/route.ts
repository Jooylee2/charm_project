import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { conversation } = await req.json();

    const prompt = `다음 아이와 AI의 대화를 분석해서 아이의 관심사를 추출해줘.
JSON 형식으로만 답해. 다른 말은 하지 마.

형식: {"interests": ["관심사1", "관심사2", ...]}

관심사는 구체적으로 (예: "공룡" "우주" "로봇" "물고기" "자동차").
대화:
${conversation}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 100, temperature: 0.3 },
    });

    const raw = response.text ?? "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ interests: parsed.interests ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ interests: [] });
  }
}
