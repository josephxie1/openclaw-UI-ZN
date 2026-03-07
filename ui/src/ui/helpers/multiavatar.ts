import multiavatar from "@multiavatar/multiavatar";

/**
 * Generate a multiavatar SVG string from a seed.
 */
export function generateAvatar(seed: string): string {
  return multiavatar(seed);
}

/**
 * Convert an SVG string to a data URI for use in <img> tags or config storage.
 */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Generate a random seed string.
 */
function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Generate N random avatar data URIs with their seeds.
 */
export function generateRandomAvatars(count: number): Array<{ seed: string; dataUri: string }> {
  const results: Array<{ seed: string; dataUri: string }> = [];
  for (let i = 0; i < count; i++) {
    const seed = randomSeed();
    const svg = generateAvatar(seed);
    results.push({ seed, dataUri: svgToDataUri(svg) });
  }
  return results;
}

/**
 * Generate an avatar data URI from a deterministic name (e.g. agent ID).
 */
export function avatarFromName(name: string): string {
  return svgToDataUri(generateAvatar(name));
}
