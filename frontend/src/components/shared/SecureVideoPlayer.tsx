import { generateSecureVideoToken } from "@/lib/bunny/stream";

interface SecureVideoPlayerProps {
  videoId: string;
  className?: string;
}

/**
 * SecureVideoPlayer (Server Component)
 * ====================================
 * Renders a secure Bunny Stream video player.
 * Generates a time-limited token authentication signature server-side.
 * The token ensures that the iframe URL cannot be copied and shared.
 */
export default function SecureVideoPlayer({
  videoId,
  className = "",
}: SecureVideoPlayerProps) {
  try {
    const { token, expires, libraryId } = generateSecureVideoToken(videoId);

    const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}&autoplay=false&loop=false&muted=false&preload=true&responsive=true`;

    return (
      <div
        className={`relative w-full overflow-hidden rounded-xl bg-black ${className}`}
        style={{ aspectRatio: "16/9" }}
      >
        <iframe
          src={embedUrl}
          loading="lazy"
          className="absolute left-0 top-0 h-full w-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
        />
      </div>
    );
  } catch (err) {
    console.error("[SecureVideoPlayer] Error generating token:", err);
    return (
      <div className={`flex items-center justify-center rounded-xl bg-slate-900 text-slate-400 ${className}`} style={{ aspectRatio: "16/9" }}>
        <p className="text-sm">Không thể tải video. Vui lòng thử lại sau.</p>
      </div>
    );
  }
}
