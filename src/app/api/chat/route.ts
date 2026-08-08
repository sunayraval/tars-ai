import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/openrouter/client";

/**
 * POST /api/chat
 * Accepts { messages, uid, apiKey, model } and streams an OpenRouter chat completion.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, uid, apiKey, model } = body;

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid in request body" },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No OpenRouter API key configured. Please add your API key in Settings.",
        },
        { status: 400 }
      );
    }

    const selectedModel = model ?? "openrouter/free";

    // Stream the response
    const stream = streamChat(messages, apiKey, selectedModel);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
