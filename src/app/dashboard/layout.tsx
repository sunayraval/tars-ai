'use client';

import React from 'react';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { ScheduleProvider } from '@/contexts/ScheduleContext';
import OnboardingGate from '@/components/settings/OnboardingGate';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGate>
        <ChatProvider>
          <ScheduleProvider>
            <div className="flex h-screen bg-transparent overflow-hidden">
              {/* Sidebar */}
              <aside className="hidden lg:flex flex-col w-72 bg-black/30 backdrop-blur-2xl border-r border-white/10">
                {/* Logo / Brand */}
                <div className="px-6 py-5 border-b border-white/10">
                  <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 glow-violet">
                      ⏱️
                    </span>
                    TARS-AI
                  </h1>
                  <p className="text-xs text-white/50 mt-1">
                    AI-powered daily planner
                  </p>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-4 py-4 space-y-1">
                  <NavLink label="Dashboard" icon="📊" href="/dashboard" />
                  <NavLink label="Tasks" icon="📝" href="/dashboard/tasks" />
                  <NavLink label="History" icon="📜" href="/dashboard/history" />
                </nav>

                {/* User section */}
                <UserFooter />
              </aside>

              {/* Main content */}
              <main className="flex-1 overflow-hidden flex flex-col">
                <OnboardingGate>
                  {children}
                </OnboardingGate>
              </main>
            </div>
          </ScheduleProvider>
        </ChatProvider>
      </AuthGate>
    </AuthProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuthContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-10 w-10 mx-auto border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm text-white/50">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
        </div>
        <div className="text-center max-w-sm px-6 glass p-8 z-10">
          <div className="text-5xl mb-4">⏱️</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            TARS-AI
          </h1>
          <p className="text-sm text-white/60 mb-6">
            Sign in to access your AI-powered daily planner.
          </p>
          <button
            onClick={signIn}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium transition-all glow-violet flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLink({
  label,
  icon,
  href,
}: {
  label: string;
  icon: string;
  href: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  
  return (
    <Link href={href}>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer glass-hover ${
          active
            ? 'bg-white/10 text-violet-300 font-medium border border-white/20'
            : 'text-white/60 hover:text-white border border-transparent'
        }`}
      >
        <span>{icon}</span>
        {label}
      </div>
    </Link>
  );
}

function UserFooter() {
  const { user, signOut } = useAuthContext();

  if (!user) return null;

  return (
    <div className="px-4 py-4 border-t border-white/10 glass">
      <div className="flex items-center gap-3">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="h-8 w-8 rounded-full border border-white/20"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-violet-900/50 flex items-center justify-center text-xs font-bold text-violet-300 border border-violet-500/30">
            {user.displayName?.[0] ?? 'U'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {user.displayName ?? 'User'}
          </p>
          <p className="text-[10px] text-white/50 truncate">{user.email}</p>
        </div>
        <button
          onClick={signOut}
          className="text-white/40 hover:text-red-400 transition-colors"
          title="Sign out"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
