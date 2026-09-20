import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const distAssetsDir = path.join(projectRoot, "dist", "assets");
const reportsDir = path.join(projectRoot, "reports", "performance");
const reportPath = path.join(reportsDir, "bundle-summary.json");

const formatKilobytes = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;

const readBundleSummary = async () => {
  const entries = await fs.readdir(distAssetsDir, { withFileTypes: true });
  const assetStats = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const assetPath = path.join(distAssetsDir, entry.name);
        const stats = await fs.stat(assetPath);
        const ext = path.extname(entry.name).slice(1);

        return {
          bytes: stats.size,
          ext,
          file: entry.name,
        };
      }),
  );

  const jsAssets = assetStats
    .filter((asset) => asset.ext === "js")
    .sort((left, right) => right.bytes - left.bytes);

  const cssAssets = assetStats
    .filter((asset) => asset.ext === "css")
    .sort((left, right) => right.bytes - left.bytes);

  return {
    generatedAt: new Date().toISOString(),
    largestCssAsset: cssAssets[0] ?? null,
    largestJsAsset: jsAssets[0] ?? null,
    topCssAssets: cssAssets.slice(0, 5),
    topJsAssets: jsAssets.slice(0, 10),
  };
};

const main = async () => {
  try {
    await fs.access(distAssetsDir);
  } catch {
    throw new Error("Build output was not found. Run `npm run build` before `npm run perf:bundles`.");
  }

  const summary = await readBundleSummary();
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("Bundle analysis written to reports/performance/bundle-summary.json");
  console.log("");
  console.log("Top JavaScript assets:");

  for (const asset of summary.topJsAssets) {
    console.log(`- ${asset.file}: ${formatKilobytes(asset.bytes)}`);
  }

  if (summary.topCssAssets.length > 0) {
    console.log("");
    console.log("Top CSS assets:");

    for (const asset of summary.topCssAssets) {
      console.log(`- ${asset.file}: ${formatKilobytes(asset.bytes)}`);
    }
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
