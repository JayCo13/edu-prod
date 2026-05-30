import { ImageResponse } from "next/og";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Dynamic favicon — clips the Edura logo to a circle.
 *
 * Next.js calls this at build time and serves the resulting PNG at
 * `/icon`, plus auto-injects the <link rel="icon"> tag. The static
 * `app/icon.png` was removed so this route is the single source of
 * truth.
 *
 * Runs on the Node.js runtime (not Edge) because we read the source
 * PNG from disk via fs/promises and feed it into ImageResponse as a
 * base64 data URL.
 */

export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const logoPath = path.join(process.cwd(), "public", "edura-logo.png");
  const buf = await fs.readFile(logoPath);
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        {/* Phóng to ảnh + crop "object-cover" để chỉ giữ phần biểu
            tượng trung tâm (icon chính), bỏ chữ "edura" phía dưới —
            ở kích thước favicon 16-32px wordmark không đọc nổi. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          width={88}
          height={88}
          style={{
            objectFit: "cover",
            objectPosition: "center 30%",
            transform: "scale(1.05)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
