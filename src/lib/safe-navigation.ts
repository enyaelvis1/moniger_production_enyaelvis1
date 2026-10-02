const INTERNAL_ORIGIN = "https://moniger.invalid";

/** Accept only canonical paths inside the app. */
export const getSafeInternalPath = (candidate: string | null | undefined, fallback = "/dashboard") => {
  const value = typeof candidate === "string" ? candidate.trim() : "";
  if (!value || Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 0x20 || codePoint === 0x7f;
  })) return fallback;

  let decoded = value;
  try {
    // Decode repeatedly so double-encoded protocol-relative paths cannot be
    // reinterpreted as external URLs by a later router or browser layer.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return fallback;
  }

  if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN || !parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};
