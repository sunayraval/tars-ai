import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/calendar/google";
import crypto from "crypto";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase/config";

const db = getFirestore(app);

/**
 * Encrypts a value using AES-256-GCM with the ENCRYPTION_SECRET env var.
 */
function encryptToken(plaintext: string): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET not configured");

  const key = Buffer.from(secret, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:ciphertext
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * GET /api/calendar/callback
 * Receives the OAuth2 callback from Google, exchanges the code for tokens,
 * and stores the encrypted refresh token in Firestore.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // userId

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard?calendar=error&reason=missing_params", request.url)
      );
    }

    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/dashboard?calendar=error&reason=no_refresh_token", request.url)
      );
    }

    // Encrypt and store the refresh token
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    const tokenDocRef = doc(db, "users", state, "calendarTokens", "google");
    await setDoc(tokenDocRef, {
      encryptedRefreshToken,
      connectedAt: new Date(),
      scope: tokens.scope ?? "calendar.readonly",
    });

    return NextResponse.redirect(
      new URL("/dashboard?calendar=connected", request.url)
    );
  } catch (error) {
    console.error("Calendar callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard?calendar=error&reason=exchange_failed", request.url)
    );
  }
}
