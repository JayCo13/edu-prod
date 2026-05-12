"use client";

import { useState, useTransition, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as tus from "tus-js-client";
import {
  Video,
  Loader2,
  Save,
  Link as LinkIcon,
  Clock,
  Eye,
  ExternalLink,
  UploadCloud,
  XCircle,
} from "lucide-react";

import type { LessonRow } from "@/types/database";
import { updateLessonContent, getBunnyUploadTicket, confirmVideoUpload } from "@/app/actions/curriculum";

/**
 * VideoEditor
 * ===========
 * Editor for "video" type lessons.
 * Features:
 *   - Direct Video Upload to BunnyCDN via TUS protocol (drag & drop)
 *   - URL input for external video source fallback
 *   - Live preview via iframe/video tag
 *   - Duration input (minutes:seconds)
 *   - Free preview toggle
 *   - Save action
 */

interface VideoEditorProps {
  lesson: LessonRow;
  courseId: string;
  onSaved?: (lesson: LessonRow) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getEmbedUrl(url: string): { type: "iframe" | "video"; src: string } | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();

  // BunnyCDN direct guid (stored as bunny://{guid})
  if (trimmed.startsWith("bunny://")) {
    const guid = trimmed.replace("bunny://", "");
    // Note: To properly preview this in the admin, we would ideally generate a secure token here,
    // or just rely on a public preview domain if the library is public for admins.
    // For now, we'll assume there is a generic iframe URL or we show a placeholder.
    // Usually, admins use a direct preview URL or the same iframe.
    // We'll use the iframe.mediadelivery.net URL.
    return { type: "iframe", src: `https://iframe.mediadelivery.net/embed/${process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || "YOUR_LIB_ID"}/${guid}` };
  }

  // YouTube
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    return {
      type: "iframe",
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
    };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(
    /(?:vimeo\.com\/)(\d+)/,
  );
  if (vimeoMatch) {
    return {
      type: "iframe",
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  // BunnyCDN iframe embed
  if (trimmed.includes("iframe.mediadelivery.net")) {
    return { type: "iframe", src: trimmed };
  }

  // Direct video URL (mp4, webm, etc.)
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(trimmed)) {
    return { type: "video", src: trimmed };
  }

  // Assume iframe for other URLs
  return { type: "iframe", src: trimmed };
}

function secondsToMinSec(totalSeconds: number): {
  minutes: number;
  seconds: number;
} {
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

export default function VideoEditor({
  lesson,
  courseId,
  onSaved,
}: VideoEditorProps) {
  const [videoUrl, setVideoUrl] = useState(lesson.video_url || "");
  const [isFreePreview, setIsFreePreview] = useState(lesson.is_free_preview);
  const [isSaving, startSaveTransition] = useTransition();

  const initDuration = secondsToMinSec(lesson.video_duration || 0);
  const [minutes, setMinutes] = useState(initDuration.minutes);
  const [seconds, setSeconds] = useState(initDuration.seconds);

  // Upload State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  // ── Embed Preview ───────────────────────────────────────────
  const embedInfo = useMemo(() => getEmbedUrl(videoUrl), [videoUrl]);

  // ── File Upload Handler (Dropzone) ──────────────────────────
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      try {
        // 1. Get ticket from server
        const ticketResult = await getBunnyUploadTicket(lesson.id, courseId, lesson.title || file.name);
        
        if (!ticketResult.success || !ticketResult.data) {
          throw new Error(ticketResult.error || "Không thể khởi tạo upload.");
        }

        const { signature, expirationTime, libraryId, videoId } = ticketResult.data;

        // 2. Initialize TUS Upload
        const upload = new tus.Upload(file, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            AuthorizationSignature: signature,
            AuthorizationExpire: expirationTime.toString(),
            VideoId: videoId,
            LibraryId: libraryId,
          },
          metadata: {
            filetype: file.type,
            title: lesson.title || file.name,
          },
          onError: function (error) {
            console.error("TUS Upload Failed:", error);
            setUploadError("Quá trình tải lên bị lỗi. Vui lòng thử lại.");
            setIsUploading(false);
          },
          onProgress: function (bytesUploaded, bytesTotal) {
            const percentage = (bytesUploaded / bytesTotal) * 100;
            setUploadProgress(percentage);
          },
          onSuccess: async function () {
            setIsUploading(false);
            setUploadProgress(100);
            
            // Set local videoUrl to the bunny format so the preview updates
            const newBunnyUrl = `bunny://${videoId}`;
            setVideoUrl(newBunnyUrl);

            // Confirm on backend
            await confirmVideoUpload(lesson.id, courseId);
            toast.success("Tải video lên thành công!");
          },
        });

        uploadRef.current = upload;
        upload.start();

      } catch (err: any) {
        setUploadError(err.message || "Đã xảy ra lỗi khi upload.");
        setIsUploading(false);
      }
    },
    [lesson.id, courseId, lesson.title]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".avi", ".webm", ".mkv"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const cancelUpload = () => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError("Đã hủy tải lên.");
    }
  };

  // ── Save Handler ────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const totalSeconds = minutes * 60 + seconds;

    startSaveTransition(async () => {
      const result = await updateLessonContent(lesson.id, courseId, {
        video_url: videoUrl || null,
        video_duration: totalSeconds,
        is_free_preview: isFreePreview,
      });
      if (result.success && result.data) {
        toast.success("Đã lưu thông tin video.");
        onSaved?.(result.data);
      } else {
        toast.error(result.error || "Không thể lưu.");
      }
    });
  }, [videoUrl, minutes, seconds, isFreePreview, lesson.id, courseId, onSaved]);

  return (
    <div className="space-y-6">
      {/* ── Direct Video Upload Zone ──────────────────────── */}
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">
          <UploadCloud className="h-3.5 w-3.5" />
          Tải Video Trực Tiếp (Khuyên dùng)
        </label>

        {!isUploading ? (
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragActive
                ? "border-indigo-400 bg-indigo-50/50"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100/50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="mb-3 rounded-full bg-indigo-100 p-3 text-indigo-600">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Kéo thả file video vào đây, hoặc click để chọn file
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Hỗ trợ định dạng MP4, MOV, WEBM. Kích thước tối đa tùy thuộc vào cấu hình BunnyCDN.
            </p>
            {uploadError && (
              <p className="mt-3 text-sm text-rose-500 font-medium flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                {uploadError}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Đang tải video lên hệ thống...</p>
                  <p className="text-xs text-slate-500">Vui lòng không đóng trình duyệt</p>
                </div>
              </div>
              <button
                onClick={cancelUpload}
                className="text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                Hủy
              </button>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="absolute inset-y-0 left-0 bg-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="mt-2 text-right text-xs font-medium text-slate-600">
              {uploadProgress.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-100"></div>
        <span className="text-xs font-medium text-slate-400">HOẶC DÙNG LINK NGOÀI</span>
        <div className="h-px flex-1 bg-slate-100"></div>
      </div>

      {/* ── Video URL Input (Fallback) ────────────────────── */}
      <div>
        <label
          htmlFor="video-url-input"
          className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600"
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Đường dẫn Video (URL)
        </label>
        <input
          id="video-url-input"
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... hoặc URL trực tiếp"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
        <p className="mt-1.5 text-[11px] text-slate-400">
          Chỉ nhập nếu bạn muốn dùng video từ YouTube/Vimeo. Nếu đã upload thành công ở trên, trường này sẽ có định dạng <code>bunny://...</code>
        </p>
      </div>

      {/* ── Video Preview ───────────────────────────────── */}
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">
          <Video className="h-3.5 w-3.5" />
          Xem trước Video
        </label>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {embedInfo ? (
            <div className="relative aspect-video w-full">
              {embedInfo.type === "iframe" ? (
                <iframe
                  src={embedInfo.src}
                  title="Video preview"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={embedInfo.src}
                  controls
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                >
                  <track kind="captions" />
                </video>
              )}
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center text-slate-400">
              <Video className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm">
                Video của bạn sẽ hiển thị ở đây
              </p>
            </div>
          )}
        </div>
        {videoUrl && !videoUrl.startsWith("bunny://") && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700"
          >
            <ExternalLink className="h-3 w-3" />
            Mở trong tab mới
          </a>
        )}
      </div>

      {/* ── Duration + Free Preview Row ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Duration */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            Thời lượng video
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={999}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                phút
              </span>
            </div>
            <span className="text-slate-400">:</span>
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={59}
                value={seconds}
                onChange={(e) =>
                  setSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                giây
              </span>
            </div>
          </div>
        </div>

        {/* Free Preview Toggle */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600">
            <Eye className="h-3.5 w-3.5" />
            Cho phép xem thử miễn phí
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={isFreePreview}
            onClick={() => setIsFreePreview(!isFreePreview)}
            className={`relative mt-1 inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:ring-offset-2 ${
              isFreePreview ? "bg-emerald-500" : "bg-slate-200"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isFreePreview ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {isFreePreview
              ? "Học viên có thể xem bài này miễn phí"
              : "Chỉ học viên đã mua mới xem được"}
          </p>
        </div>
      </div>

      {/* ── Save Button ─────────────────────────────────── */}
      <div className="flex justify-end border-t border-slate-100 pt-4">
        <motion.button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isUploading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          whileTap={isSaving || isUploading ? {} : { scale: 0.97 }}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu thông tin video
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
