export const normalizeConfiguredAppBaseUrl = (rawValue: string) => {
  if (!rawValue.trim()) {
    throw new Error("APP_BASE_URL is required for security-sensitive links.");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawValue.trim());
  } catch {
    throw new Error("APP_BASE_URL must be a valid absolute URL.");
  }

  const isLocalHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("APP_BASE_URL must use HTTPS except for approved local development hosts.");
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("APP_BASE_URL must not contain credentials, query parameters, or fragments.");
  }

  return parsed.toString().replace(/\/$/, "");
};

export const getConfiguredAppBaseUrl = () => normalizeConfiguredAppBaseUrl(Deno.env.get("APP_BASE_URL") ?? "");
