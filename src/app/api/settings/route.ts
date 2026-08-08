import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getFirestore, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase/config";
import { FieldValue, deleteField } from "firebase/firestore";

const db = getFirestore(app);

// ─── Encryption Helpers ────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM with the ENCRYPTION_SECRET env var.
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET not configured");

  const key = Buffer.from(secret, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with the encrypt() function.
 */
export function decrypt(encryptedValue: string): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET not configured");

  const [ivHex, authTagHex, ciphertext] = encryptedValue.split(":");
  const key = Buffer.from(secret, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── Route Handlers ────────────────────────────────────────────────────────────

/**
 * POST /api/settings
 * Stores an encrypted OpenRouter API key and optional model preference.
 * Body: { apiKey: string, uid: string, model?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, uid, model } = body;

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid in request body" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing apiKey in request body" },
        { status: 400 }
      );
    }

    const encryptedApiKey = encrypt(apiKey);

    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);

    const updateData: Record<string, unknown> = {
      encryptedApiKey,
      model: model ?? "openrouter/free",
      settingsUpdatedAt: new Date(),
    };

    if (userSnap.exists()) {
      await updateDoc(userDocRef, updateData);
    } else {
      await setDoc(userDocRef, updateData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings POST error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/settings?uid=<uid>
 * Returns whether the user has an API key configured and their model preference.
 * NEVER returns the actual API key.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid query parameter" },
        { status: 400 }
      );
    }

    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      return NextResponse.json({
        hasApiKey: false,
        model: "openrouter/free",
      });
    }

    const data = userSnap.data();

    return NextResponse.json({
      hasApiKey: !!data?.encryptedApiKey,
      model: data?.model ?? "openrouter/free",
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/settings
 * Removes the encrypted API key from the user's document.
 * Body: { uid: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid } = body;

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid in request body" },
        { status: 400 }
      );
    }

    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    await updateDoc(userDocRef, {
      encryptedApiKey: deleteField(),
      settingsUpdatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings DELETE error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
