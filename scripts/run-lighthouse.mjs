import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";

const projectRoot = process.cwd();
const reportsDir = path.join(projectRoot, "reports", "performance", "lighthouse");
const reportBasePath = path.join(reportsDir, "latest");
const previewHost = "127.0.0.1";
const previewPort = Number(process.env.LIGHTHOUSE_PORT ?? 4173);
const previewUrl = `http://${previewHost}:${previewPort}`;
const targetPath = process.env.LIGHTHOUSE_TARGET_PATH ?? "/";
const targetUrl = new URL(targetPath, previewUrl).toString();
const thresholds = {
  accessibility: 0.85,
  "best-practices": 0.9,
  performance: 0.75,
};

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";
const useShell = process.platform === "win32";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPort = async (host, port, timeoutMs = 30_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const isReady = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve(true);
      });

      socket.on("error", () => resolve(false));
    });

    if (isReady) {
      return;
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for preview server on ${host}:${port}.`);
};

const runProcess = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      shell: useShell,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}.`));
    });
  });

const summarizeCategories = (payload) => {
  const categories = payload?.categories ?? {};

  return Object.fromEntries(
    Object.entries(thresholds).map(([key, minimumScore]) => {
      const category = categories[key];
      const score = typeof category?.score === "number" ? category.score : 0;

      return [
        key,
        {
          minimumScore,
          passed: score >= minimumScore,
          score,
          title: category?.title ?? key,
        },
      ];
    }),
  );
};

const main = async () => {
  await fs.mkdir(reportsDir, { recursive: true });

  const previewProcess = spawn(
    npmExecutable,
    ["run", "preview", "--", "--host", previewHost, "--port", String(previewPort), "--strictPort"],
    {
      cwd: projectRoot,
      env: process.env,
      shell: useShell,
      stdio: "inherit",
    },
  );

  let previewExited = false;
  previewProcess.on("exit", () => {
    previewExited = true;
  });

  try {
    await waitForPort(previewHost, previewPort);

    await runProcess(npxExecutable, [
      "--yes",
      "lighthouse",
      targetUrl,
      "--output=json",
      "--output=html",
      `--output-path=${reportBasePath}`,
      "--quiet",
      "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
    ]);

    const reportJson = JSON.parse(await fs.readFile(`${reportBasePath}.report.json`, "utf8"));
    const categories = summarizeCategories(reportJson);
    const summaryPath = path.join(reportsDir, "summary.json");

    await fs.writeFile(
      summaryPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          targetUrl,
          thresholds,
          categories,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log(`Lighthouse report written to ${path.relative(projectRoot, `${reportBasePath}.report.html`)}`);
    console.log(`Lighthouse summary written to ${path.relative(projectRoot, summaryPath)}`);

    const failedCategory = Object.values(categories).find((category) => !category.passed);

    if (failedCategory) {
      throw new Error(
        `Lighthouse thresholds not met for ${failedCategory.title}. See reports/performance/lighthouse/summary.json.`,
      );
    }
  } finally {
    if (!previewExited) {
      previewProcess.kill();
    }
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
