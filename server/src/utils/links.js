/** Accepts a YouTube URL in any of its shapes, or a bare id, and returns the id. */
export function youtubeId(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  // Already an id.
  if (/^[\w-]{11}$/.test(value)) return value;

  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return '';
}
