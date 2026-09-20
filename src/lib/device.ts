export type DeviceSnapshot = {
  browser: string;
  label: string;
  os: string;
  platform: string;
};

const detectBrowser = (userAgent: string) => {
  if (/edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return "Google Chrome";
  if (/firefox\//i.test(userAgent)) return "Mozilla Firefox";
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return "Safari";
  return "Unknown Browser";
};

const detectOs = (userAgent: string, platform: string) => {
  if (/windows/i.test(userAgent) || /win/i.test(platform)) return "Windows";
  if (/mac os x|macintosh/i.test(userAgent) || /mac/i.test(platform)) return "macOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/linux/i.test(userAgent) || /linux/i.test(platform)) return "Linux";
  return "Unknown OS";
};

export const getCurrentDeviceSnapshot = (
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
  platform = typeof navigator !== "undefined" ? navigator.platform || navigator.userAgent : "",
): DeviceSnapshot => {
  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent, platform);

  return {
    browser,
    label: `${browser} on ${os}`,
    os,
    platform: platform || "Unknown platform",
  };
};
