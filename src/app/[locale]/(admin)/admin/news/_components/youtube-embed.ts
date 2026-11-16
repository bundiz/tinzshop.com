const ID = /^[\w-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

/** Seconds from `t=42`, `t=1m30s` or `start=42`; 0 when absent or not understood. */
function startSeconds(url: URL): number {
  const raw = url.searchParams.get('start') ?? url.searchParams.get('t') ?? '';
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (match === null || raw === '') return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

/**
 * The embed address (`https://www.youtube.com/embed/ID`, plus `?start=` when a start time is given) for a link to ONE
 * YouTube video: `watch?v=`, `youtu.be/`, `/embed/ID` or `/shorts/ID`. A playlist-only link, another site, or anything
 * else gives null. The result is always on `www.youtube.com`: the body sanitiser drops any other host (ruling R14).
 */
export function youtubeEmbedFromUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  let id: string | null = null;
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null;
  else if (HOSTS.has(url.hostname)) {
    const [first, second] = url.pathname.split('/').filter(Boolean);
    if (first === 'watch') id = url.searchParams.get('v');
    else if (first === 'embed' || first === 'shorts') id = second ?? null;
  }
  // `videoseries` is the playlist embed's path, and is as long as a video id.
  if (id === null || id === 'videoseries' || !ID.test(id)) return null;
  const start = startSeconds(url);
  return `https://www.youtube.com/embed/${id}${start > 0 ? `?start=${start}` : ''}`;
}

/** Whether `src` is an embed address the body sanitiser keeps: https or http, `youtube.com` or `www.youtube.com`, `/embed/…`. */
export function isStoredYoutubeEmbed(src: string): boolean {
  try {
    const url = new URL(src.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') && url.pathname.startsWith('/embed/');
  } catch {
    return false;
  }
}
