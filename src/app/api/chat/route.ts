import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/openrouter/client";
import crypto from "crypto";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase/config";

const db = getFirestore(app);

/**
 * Decrypts a value encrypted with AES-256-GCM.
 */
function decryptApiKey(encrypted: string): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET not configured");

  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
  const key = Buffer.from(secret, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * POST /api/chat
 * Accepts { messages, uid } and streams an OpenRouter chat completion.
 * The API key is retrieved from Firestore and decrypted server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, uid } = body;

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

    // Retrieve the user's encrypted API key and model preference
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userSnap.data();
    const encryptedApiKey = userData?.encryptedApiKey;

    if (!encryptedApiKey) {
      return NextResponse.json(
        {
          error:
            "No OpenRouter API key configured. Please add your API key in Settings.",
        },
        { status: 400 }
      );
    }

    const apiKey = decryptApiKey(encryptedApiKey);
    const model = userData?.model ?? "openrouter/free";

    // Stream the response
    const stream = streamChat(messages, apiKey, model);

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
