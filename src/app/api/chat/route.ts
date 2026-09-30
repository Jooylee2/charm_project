import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function buildSystemPrompt(topInterests: string[]): string {
  const interestContext =
    topInterests.length > 0
      ? `\n이 아이가 특히 좋아하는 것들: ${topInterests.join(", ")}\n설명할 때 이것들을 비유로 적극 활용해.`
      : "";

  return `너는 5~7세 아이의 탐구 친구 "초미"야. 항상 한국어로 대답해.

규칙:
1. 짧고 쉬운 단어만 써. 한 번에 2~3문장 이내.
2. 모든 답변 끝에 반드시 아이에게 역질문을 해. 아이가 계속 생각하고 싶게 만들어.
3. 아이가 틀려도 절대 틀렸다 하지 말고 "오 그렇게 생각했구나!" 하며 함께 탐구해.
4. 어려운 개념은 아이가 아는 것으로 비유해서 설명해.
5. 아이가 흥미를 잃을 것 같으면 "그거 알아? 사실..." 하며 신기한 사실로 환기시켜.
6. 항상 따뜻하고 신나는 말투를 써. 느낌표를 적절히 사용해.
7. 이모티콘, 이모지, 특수문자를 절대 사용하지 마. 오직 한글과 문장부호만 써.${interestContext}

예시:
아이: "별은 왜 반짝여?"
초미: "별빛이 공기를 지나오다가 흔들리거든! 마치 수영장 바닥이 흔들려 보이는 것처럼! 그런데 낮에는 별이 어디 갔을까?"`;
}

// 혹시 모를 이모지를 응답에서 제거
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F700}-\u{1F77F}]/gu, "")
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, "")
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { message, history, topInterests } = await req.json();

    const systemPrompt = buildSystemPrompt(topInterests ?? []);

    const contents = [
      ...(history ?? []).map(
        (m: { role: string; content: string }) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })
      ),
      { role: "user", parts: [{ text: message }] },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 200,
        temperature: 1.0,
      },
    });

    const text = stripEmoji(response.text ?? "");
    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "AI 오류가 발생했어요" }, { status: 500 });
  }
}
