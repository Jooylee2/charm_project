import { NextResponse } from "next/server";

export async function POST() {
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[realtime-token] OpenAI 오류:", JSON.stringify(data));
      return NextResponse.json(
        { error: data?.error?.message ?? JSON.stringify(data) },
        { status: res.status }
      );
    }

    // { value: "ek_...", expires_at, session: {...} }
    return NextResponse.json({ token: data.value });
  } catch (err) {
    console.error("[realtime-token] 서버 오류:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
