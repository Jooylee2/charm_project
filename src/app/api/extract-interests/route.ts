import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { conversation } = await req.json();

    const prompt = `다음 아이와 AI의 대화를 분석해서 아이의 관심사를 추출해줘.
JSON 형식으로만 답해. 다른 말은 하지 마.

형식: {"interests": ["관심사1", "관심사2", ...]}

관심사는 구체적으로 (예: "공룡" "우주" "로봇" "물고기" "자동차").
대화:
${conversation}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[extract-interests] OpenAI 오류:", JSON.stringify(data));
      return NextResponse.json({ interests: [] });
    }

    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return NextResponse.json({ interests: parsed.interests ?? [] });
  } catch (err) {
    console.error("[extract-interests] 오류:", err);
    return NextResponse.json({ interests: [] });
  }
}
