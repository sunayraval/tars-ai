import { google } from "googleapis";
import { Task } from "@/lib/firebase/firestore";

/**
 * Represents a unified agenda entry — either a calendar event or a Firestore task.
 */
export interface AgendaEntry {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  type: "calendar" | "task";
  source: string;
  status?: string;
  taskId?: string;
}

/**
 * Creates an OAuth2 client configured from environment variables.
 */
export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates a Google OAuth2 consent URL.
 * The userId is encoded in the `state` parameter so the callback can associate tokens with the user.
 */
export function getAuthUrl(userId: string): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    state: userId,
  });
}

/**
 * Exchanges an authorization code for OAuth2 tokens.
 */
export async function exchangeCode(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Fetches today's calendar events using a stored refresh token.
 * Returns a normalized array of AgendaEntry items.
 */
export async function fetchTodayEvents(
  refreshToken: string
): Promise<AgendaEntry[]> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  const events = response.data.items ?? [];

  return events.map((event) => ({
    id: event.id ?? crypto.randomUUID(),
    title: event.summary ?? "(No title)",
    startTime:
      event.start?.dateTime ?? event.start?.date ?? startOfDay.toISOString(),
    endTime:
      event.end?.dateTime ?? event.end?.date ?? endOfDay.toISOString(),
    type: "calendar" as const,
    source: "google_calendar",
  }));
}

/**
 * Merges Google Calendar events and Firestore tasks into a unified
 * AgendaEntry[] sorted by start time.
 */
export function mergeWithTasks(
  events: AgendaEntry[],
  tasks: Task[]
): AgendaEntry[] {
  const taskEntries: AgendaEntry[] = tasks.map((task) => {
    const start = task.scheduledStart
      ? task.scheduledStart instanceof Date
        ? task.scheduledStart.toISOString()
        : task.scheduledStart.toDate().toISOString()
      : new Date().toISOString();

    const end = task.scheduledEnd
      ? task.scheduledEnd instanceof Date
        ? task.scheduledEnd.toISOString()
        : task.scheduledEnd.toDate().toISOString()
      : start;

    return {
      id: `task-${task.id}`,
      title: task.title,
      startTime: start,
      endTime: end,
      type: "task" as const,
      source: "firestore",
      status: task.status,
      taskId: task.id,
    };
  });

  const merged = [...events, ...taskEntries];
  merged.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  return merged;
}
