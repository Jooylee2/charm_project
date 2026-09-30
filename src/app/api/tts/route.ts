import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: "ko-KR", name: "ko-KR-Wavenet-A" },
          audioConfig: { audioEncoding: "MP3", speakingRate: 0.9, pitch: 2.0 },
        }),
      }
    );

    const data = await res.json();
    if (!data.audioContent) {
      return NextResponse.json({ error: "TTS 실패" }, { status: 500 });
    }

    return NextResponse.json({ audioContent: data.audioContent });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "TTS 오류" }, { status: 500 });
  }
}
