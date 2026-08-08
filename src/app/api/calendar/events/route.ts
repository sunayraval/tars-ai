import { NextRequest, NextResponse } from "next/server";
import { fetchTodayEvents } from "@/lib/calendar/google";
import crypto from "crypto";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase/config";

const db = getFirestore(app);

/**
 * Decrypts a value encrypted with AES-256-GCM.
 */
function decryptToken(encrypted: string): string {
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
 * GET /api/calendar/events?uid=<uid>
 * Fetches today's Google Calendar events for the given user.
 * Returns an empty array if no calendar is connected (graceful degradation).
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

    // Retrieve stored calendar token
    const tokenDocRef = doc(db, "users", uid, "calendarTokens", "google");
    const tokenSnap = await getDoc(tokenDocRef);

    if (!tokenSnap.exists()) {
      // No calendar connected — return empty array, not an error
      return NextResponse.json([]);
    }

    const { encryptedRefreshToken } = tokenSnap.data();
    if (!encryptedRefreshToken) {
      return NextResponse.json([]);
    }

    const refreshToken = decryptToken(encryptedRefreshToken);
    const events = await fetchTodayEvents(refreshToken);

    return NextResponse.json(events);
  } catch (error) {
    console.error("Calendar events error:", error);
    // Graceful degradation: return empty array on error
    return NextResponse.json([]);
  }
}
