export const LIMITS = { ALLOWED_IMAGE_EXT: ['.jpg', '.jpeg', '.png', '.webp'] };
export function isAllowedImageUrl(url) {
  try { const u = new URL(url); const lower = u.pathname.toLowerCase();
    return LIMITS.ALLOWED_IMAGE_EXT.some(ext => lower.endsWith(ext)); } catch { return false; }
}
