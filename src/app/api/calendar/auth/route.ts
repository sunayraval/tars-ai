import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/calendar/google";

/**
 * GET /api/calendar/auth?userId=<uid>
 * Generates a Google OAuth2 consent URL for calendar integration.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId query parameter" },
        { status: 400 }
      );
    }

    const url = getAuthUrl(userId);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Calendar auth error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
