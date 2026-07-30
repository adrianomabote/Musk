import { Router } from "express";
import OpenAI, { toFile } from "openai";
import { logger } from "../lib/logger";

const router = Router();

if (!process.env.OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY is not set — assistant routes will fail");
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are Replit, a smart voice assistant for Android. You help users control their phone and answer questions.

When the user asks to perform a device action, respond naturally in 1-2 short sentences and include ONE action token at the very end:

[ACTION:flashlight_on]          — turn on flashlight
[ACTION:flashlight_off]         — turn off flashlight
[ACTION:open_app:whatsapp]      — open WhatsApp
[ACTION:open_app:spotify]       — open Spotify
[ACTION:open_app:youtube]       — open YouTube
[ACTION:open_app:instagram]     — open Instagram
[ACTION:open_app:chrome]        — open Chrome browser
[ACTION:open_app:telegram]      — open Telegram
[ACTION:open_app:netflix]       — open Netflix
[ACTION:open_app:facebook]      — open Facebook
[ACTION:open_app:twitter]       — open Twitter/X
[ACTION:open_app:tiktok]        — open TikTok
[ACTION:open_app:gmail]         — open Gmail
[ACTION:open_app:maps]          — open Maps
[ACTION:search_web:query]       — search the web for "query"
[ACTION:call:phone_number]      — make a phone call
[ACTION:send_whatsapp:phone:message] — send WhatsApp message
[ACTION:open_maps:destination]  — open maps for destination

Rules:
- Always respond in the SAME language the user uses (Portuguese if they write in Portuguese)
- For actions: keep response to 1 sentence max
- For unknown apps use [ACTION:open_app:appname]
- Include action token ONLY when user requests a device action
- Never include multiple action tokens
- For general questions, answer naturally without an action token`;

function parseAction(text: string): { cleanText: string; action?: { type: string; param?: string } } {
  const match = text.match(/\[ACTION:([^\]]+)\]/);
  if (!match) return { cleanText: text.trim() };

  const cleanText = text.replace(/\[ACTION:[^\]]+\]/, "").trim();
  const parts = match[1].split(":");
  const type = parts[0];
  const param = parts.slice(1).join(":") || undefined;

  return { cleanText, action: { type, param } };
}

// ── POST /api/assistant/chat — text message ────────────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body as {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    };

    if (!message) {
      res.status(400).json({ error: "message required" });
      return;
    }

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
    });

    const rawText = completion.choices[0]?.message?.content ?? "Desculpe, não entendi.";
    const { cleanText, action } = parseAction(rawText);

    const ttsResp = await getOpenAI().audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: cleanText,
    });
    const audioBuffer = Buffer.from(await ttsResp.arrayBuffer());

    res.json({
      text: cleanText,
      action,
      audioBase64: audioBuffer.toString("base64"),
    });
  } catch (err) {
    logger.error({ err }, "assistant/chat error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── POST /api/assistant/voice — audio message ─────────────────────────────
router.post("/voice", async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = "audio/m4a",
      history = [],
    } = req.body as {
      audioBase64: string;
      mimeType: string;
      history: { role: "user" | "assistant"; content: string }[];
    };

    if (!audioBase64) {
      res.status(400).json({ error: "audioBase64 required" });
      return;
    }

    const buffer = Buffer.from(audioBase64, "base64");
    const ext = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("wav")
      ? "wav"
      : "m4a";

    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

    const transcription = await getOpenAI().audio.transcriptions.create({
      model: "whisper-1",
      file,
    });

    const transcript = transcription.text?.trim();
    if (!transcript) {
      res.json({ transcript: "", text: "Não consegui ouvir. Tente novamente.", audioBase64: "" });
      return;
    }

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: transcript },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
    });

    const rawText = completion.choices[0]?.message?.content ?? "Desculpe, não entendi.";
    const { cleanText, action } = parseAction(rawText);

    const ttsResp = await getOpenAI().audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: cleanText,
    });
    const audioRespBuffer = Buffer.from(await ttsResp.arrayBuffer());

    res.json({
      transcript,
      text: cleanText,
      action,
      audioBase64: audioRespBuffer.toString("base64"),
    });
  } catch (err) {
    logger.error({ err }, "assistant/voice error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── POST /api/assistant/transcribe — wake-word check ──────────────────────
router.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/m4a" } = req.body as {
      audioBase64: string;
      mimeType: string;
    };

    if (!audioBase64) {
      res.status(400).json({ error: "audioBase64 required" });
      return;
    }

    const buffer = Buffer.from(audioBase64, "base64");
    const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : "m4a";
    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

    const transcription = await getOpenAI().audio.transcriptions.create({
      model: "whisper-1",
      file,
    });

    res.json({ transcript: transcription.text ?? "" });
  } catch (err) {
    logger.error({ err }, "assistant/transcribe error");
    res.status(500).json({ transcript: "" });
  }
});

export default router;
