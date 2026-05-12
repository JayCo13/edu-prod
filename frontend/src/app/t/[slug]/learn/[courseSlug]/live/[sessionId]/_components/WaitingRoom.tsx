"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";

import type { LiveSessionRow } from "@/types/database";
import CountdownTimer from "./CountdownTimer";

/**
 * WaitingRoom
 * ===========
 * Full-screen dark-mode virtual waiting room.
 * Renders the session title prominently and delegates
 * countdown/button logic to <CountdownTimer>.
 */

interface WaitingRoomProps {
  session: LiveSessionRow;
  courseSlug: string;
  courseName: string;
}

export default function WaitingRoom({
  session,
  courseSlug,
  courseName,
}: WaitingRoomProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* ── Subtle Top Bar ──────────────────────────── */}
      <header className="flex items-center gap-3 border-b border-slate-800/50 px-6 py-4">
        <Link
          href={`/learn/${courseSlug}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Quay lại</span>
        </Link>
        <div className="h-4 w-px bg-slate-800" />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="truncate">{courseName}</span>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        {/* Glow effect */}
        <div className="absolute left-1/2 top-1/3 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/5 blur-3xl" />

        {/* Session Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            Buổi học trực tuyến
          </p>
          <h1 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            {session.title}
          </h1>
          {session.description && (
            <p className="mx-auto mt-4 max-w-lg text-base text-slate-400">
              {session.description}
            </p>
          )}
        </motion.div>

        {/* Countdown Timer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <CountdownTimer
            startTime={session.start_time}
            durationMinutes={session.duration_minutes}
            meetingUrl={session.meeting_url}
            meetingPassword={session.meeting_password}
          />
        </motion.div>
      </main>
    </div>
  );
}
