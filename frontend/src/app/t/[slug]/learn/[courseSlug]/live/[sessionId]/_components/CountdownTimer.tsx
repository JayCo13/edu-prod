"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Copy, Check, ExternalLink, Radio } from "lucide-react";
import { toast } from "sonner";

/**
 * CountdownTimer
 * ==============
 * Apple-event-style countdown clock.
 * - > 15 min before: Shows countdown + disabled "Phòng mở trước 15 phút" button
 * - ≤ 15 min before or during: Shows "Lớp đang mở!" + pulsing green "Vào lớp ngay" button
 * - After session ends: Shows "Buổi học đã kết thúc"
 *
 * Uses tabular-nums for non-jittery number rendering.
 */

interface CountdownTimerProps {
  startTime: string;
  durationMinutes: number;
  meetingUrl: string;
  meetingPassword: string | null;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: diff };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    totalMs: diff,
  };
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export default function CountdownTimer({
  startTime,
  durationMinutes,
  meetingUrl,
  meetingPassword,
}: CountdownTimerProps) {
  const startDate = new Date(startTime);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(startDate),
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(startDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [startDate.getTime()]);

  const copyPassword = useCallback(async () => {
    if (!meetingPassword) return;
    try {
      await navigator.clipboard.writeText(meetingPassword);
      setCopied(true);
      toast.success("Đã sao chép mật khẩu!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không thể sao chép.");
    }
  }, [meetingPassword]);

  const now = new Date();
  const isEnded = now > endDate;
  const isLive = now >= new Date(startDate.getTime() - FIFTEEN_MINUTES_MS) && !isEnded;
  const isWaiting = !isLive && !isEnded;

  // ── Ended State ─────────────────────────────────────
  if (isEnded) {
    return (
      <div className="text-center">
        <p className="text-lg text-slate-400">Buổi học đã kết thúc</p>
      </div>
    );
  }

  // ── Live State (≤ 15 min before or ongoing) ─────────
  if (isLive) {
    return (
      <div className="flex flex-col items-center gap-8">
        {/* Live indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2.5"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <span className="text-lg font-semibold text-emerald-400">
            Lớp học đang mở!
          </span>
        </motion.div>

        {/* Enter button */}
        <motion.a
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-3 rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-white shadow-lg shadow-emerald-500/30 animate-pulse transition-all hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-500/40"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Radio className="h-5 w-5" />
          Vào lớp ngay
          <ExternalLink className="h-4 w-4 opacity-60" />
        </motion.a>

        {/* Password box */}
        {meetingPassword && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/80 px-5 py-3 backdrop-blur-sm"
          >
            <span className="text-xs text-slate-400">Mật khẩu phòng:</span>
            <code className="rounded-md bg-slate-700/60 px-3 py-1 font-mono text-sm font-semibold tracking-wider text-white">
              {meetingPassword}
            </code>
            <button
              type="button"
              onClick={copyPassword}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
              title="Sao chép mật khẩu"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  // ── Waiting State (> 15 min before) ─────────────────
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Countdown Boxes */}
      <div className="flex items-center gap-3 sm:gap-5">
        {timeLeft.days > 0 && (
          <>
            <TimeUnit value={timeLeft.days} label="Ngày" />
            <Separator />
          </>
        )}
        <TimeUnit value={timeLeft.hours} label="Giờ" />
        <Separator />
        <TimeUnit value={timeLeft.minutes} label="Phút" />
        <Separator />
        <TimeUnit value={timeLeft.seconds} label="Giây" />
      </div>

      {/* Disabled button */}
      <button
        type="button"
        disabled
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl bg-slate-800 px-8 py-4 text-base font-semibold text-slate-500 shadow-inner"
      >
        <Radio className="h-5 w-5" />
        Phòng học mở trước 15 phút
      </button>

      {/* Start time info */}
      <p className="text-sm text-slate-500">
        Buổi học bắt đầu lúc{" "}
        <span className="font-medium text-slate-300">
          {startDate.toLocaleString("vi-VN", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </p>
    </div>
  );
}

// ── Sub Components ────────────────────────────────────────────────────────

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/80 shadow-lg shadow-black/20 backdrop-blur-sm sm:h-24 sm:w-24">
        <span
          className="text-4xl font-bold text-white sm:text-5xl"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value.toString().padStart(2, "0")}
        </span>
      </div>
      <span className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <div className="flex flex-col items-center gap-2 pb-6">
      <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
      <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
    </div>
  );
}
