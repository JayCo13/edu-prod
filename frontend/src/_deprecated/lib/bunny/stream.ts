import crypto from "crypto";

/**
 * Bunny Stream API Helpers
 * ========================
 * Server-side utilities for interacting with BunnyCDN Stream API.
 * Ensures API keys and security tokens are never exposed to the client.
 */

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const API_KEY = process.env.BUNNY_STREAM_API_KEY;
const TOKEN_AUTH_KEY = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;

// ── 1. Create Video Entry ──────────────────────────────────────────────────

/**
 * Create an empty video entry in the Bunny Stream library.
 * Returns the Video ID (guid) which is required before uploading via TUS.
 */
export async function createBunnyVideoEntry(title: string): Promise<string> {
  if (!LIBRARY_ID || !API_KEY) {
    throw new Error("Missing Bunny Stream credentials in environment variables.");
  }

  const response = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        AccessKey: API_KEY,
      },
      body: JSON.stringify({ title }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Bunny] Failed to create video entry:", response.status, errorText);
    throw new Error("Không thể tạo video trên hệ thống máy chủ.");
  }

  const data = await response.json();
  return data.guid;
}

// ── 2. Generate TUS Upload Signature ───────────────────────────────────────

/**
 * Generate a secure, time-limited signature so the client can upload directly
 * to Bunny CDN via TUS, without exposing our API_KEY.
 */
export function generateUploadSignature(videoId: string) {
  if (!LIBRARY_ID || !API_KEY) {
    throw new Error("Missing Bunny Stream credentials in environment variables.");
  }

  // Set expiration to 6 hours from now
  const expirationTime = Math.floor(Date.now() / 1000) + 6 * 60 * 60;

  // Signature format: SHA256(LibraryId + APIKey + ExpirationTime + VideoId)
  const signatureString = `${LIBRARY_ID}${API_KEY}${expirationTime}${videoId}`;
  const signature = crypto
    .createHash("sha256")
    .update(signatureString)
    .digest("hex");

  return {
    libraryId: LIBRARY_ID,
    videoId,
    signature,
    expirationTime,
  };
}

// ── 3. Generate Secure Video Playback Token ────────────────────────────────

/**
 * Generate a Token Authentication signature for secure video playback.
 * The iframe URL will include ?token=...&expires=...
 */
export function generateSecureVideoToken(videoId: string) {
  if (!TOKEN_AUTH_KEY) {
    throw new Error("Missing Bunny Stream Token Auth Key in environment variables.");
  }

  // Set playback expiration to 6 hours
  const expires = Math.floor(Date.now() / 1000) + 6 * 60 * 60;

  // Hash format: SHA256(SecurityKey + VideoId + Expires)
  const hashString = `${TOKEN_AUTH_KEY}${videoId}${expires}`;
  const token = crypto.createHash("sha256").update(hashString).digest("hex");

  return {
    token,
    expires,
    libraryId: LIBRARY_ID,
  };
}
