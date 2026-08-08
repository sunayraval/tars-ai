import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      {/* Hero card */}
      <div className="glass relative z-10 mx-4 max-w-md w-full p-10 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-3xl shadow-lg glow-violet">
          ⏱️
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">
          TimeManager
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-white/60">
          Your AI-powered personal planner. Build intelligent daily schedules,
          sync your calendar, and stay on track with proactive assistance.
        </p>

        <Link
          href="/dashboard"
          className="block w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg glow-violet"
        >
          Open Dashboard
        </Link>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/30">
          <span>AI Scheduling</span>
          <span>•</span>
          <span>Calendar Sync</span>
          <span>•</span>
          <span>Smart Check-ins</span>
        </div>
      </div>
    </main>
  );
}
