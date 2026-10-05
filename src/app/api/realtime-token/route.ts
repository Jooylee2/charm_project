import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[realtime-token] OpenAI 오류:", err);
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ token: data.client_secret.value });
  } catch (err) {
    console.error("[realtime-token] 서버 오류:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
