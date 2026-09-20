import { chromium } from "@playwright/test";

const readArgValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
};

const baseUrl = (readArgValue("--base-url") || "https://www.moniger.net").replace(/\/$/, "");

const assertHtmlShell = async (url) => {
  const response = await fetch(url, {
    redirect: "follow",
  });

  const html = await response.text();
  return {
    cacheControl: response.headers.get("cache-control"),
    contentType: response.headers.get("content-type"),
    ok: response.ok,
    status: response.status,
    url,
    usesIndexShell: html.includes('<div id="root"></div>') && html.includes("/assets/index-"),
  };
};

const main = async () => {
  const rootCheck = await assertHtmlShell(`${baseUrl}/`);
  const payCheck = await assertHtmlShell(`${baseUrl}/pay/test-token`);
  const payConfirmedCheck = await assertHtmlShell(`${baseUrl}/pay/test-token/confirmed`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/pay/test-token/confirmed?reference=demo&trxref=demo`, {
    timeout: 60_000,
    waitUntil: "networkidle",
  });
  const confirmedText = (await page.locator("body").innerText()).slice(0, 2000);
  await browser.close();

  const result = {
    baseUrl,
    callbackPageShowsApp: confirmedText.includes("PAYMENT CONFIRMATION"),
    callbackPageText: confirmedText,
    payCheck,
    payConfirmedCheck,
    rootCheck,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!rootCheck.ok || !rootCheck.usesIndexShell || !payCheck.ok || !payCheck.usesIndexShell || !payConfirmedCheck.ok || !payConfirmedCheck.usesIndexShell) {
    process.exit(1);
  }
};

await main();
