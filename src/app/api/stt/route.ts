import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType } = await req.json();

    console.log("[STT] 요청 수신, mimeType:", mimeType);

    const encoding = mimeType?.includes("webm") ? "WEBM_OPUS" :
                     mimeType?.includes("ogg")  ? "OGG_OPUS"  : "WEBM_OPUS";

    const res = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            encoding,
            sampleRateHertz: 48000,
            languageCode: "ko-KR",
            model: "latest_long",
            useEnhanced: true,
          },
          audio: { content: audioBase64 },
        }),
      }
    );

    const data = await res.json();
    console.log("[STT] 응답:", JSON.stringify(data).slice(0, 200));

    const transcript = data.results?.[0]?.alternatives?.[0]?.transcript ?? "";
    console.log("[STT] 인식 결과:", transcript);

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[STT] 오류:", err);
    return NextResponse.json({ transcript: "" }, { status: 500 });
  }
}
