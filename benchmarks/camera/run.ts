import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { platform, release } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

type Mode = "camera-only" | "camera-worker";

const durationSeconds = Number(readArgument("duration") ?? 1200);
const mode = (readArgument("mode") ?? "camera-worker") as Mode;
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("duration must be positive");
if (!(["camera-only", "camera-worker"] as string[]).includes(mode)) throw new Error("invalid mode");

const startedAt = new Date().toISOString();
const server = await createServer({
  server: { host: "127.0.0.1", port: 4173 },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const page = await browser.newPage({ permissions: ["camera"] });

try {
  await page.goto(`http://127.0.0.1:4173/?mode=${mode}`);
  await page.getByRole("button", { name: "Start camera" }).click();
  await page.getByText(/Camera delivering/).waitFor();
  await page.waitForTimeout(durationSeconds * 1000);
  const diagnostics = await page.evaluate(() => {
    const entries = [...document.querySelectorAll(".diagnostics dl div")];
    return Object.fromEntries(entries.map((entry) => {
      const key = entry.querySelector("dt")?.textContent ?? "unknown";
      const value = Number.parseFloat(entry.querySelector("dd")?.textContent ?? "0");
      return [key, Number.isFinite(value) ? value : null];
    }));
  });
  const version = browser.version();
  const configHash = createHash("sha256")
    .update(JSON.stringify({ durationSeconds, mode }))
    .digest("hex");
  const result = {
    benchmarkVersion: "camera-v1",
    commit: "git-metadata-unavailable",
    fixtureId: `desktop-fake-${mode}`,
    startedAt,
    device: "desktop-fake-camera",
    os: `${platform()} ${release()}`,
    browser: `Chromium ${version}`,
    configHash,
    metrics: {
      durationSeconds,
      previewFps: diagnostics.Preview ?? null,
      processedFps: diagnostics.Processed ?? null,
      frameAgeMsP95: diagnostics["Frame age p95"] ?? null,
      droppedFrames: diagnostics.Dropped ?? null,
    },
    exclusions: ["Fake desktop media is diagnostic evidence only; it cannot pass Gate 1."],
    unmeasurableCount: 0,
    artifactChecksums: [],
  };
  validateResult(result);
  const directory = join("benchmarks", "camera", "artifacts");
  await mkdir(directory, { recursive: true });
  const filename = join(directory, `${startedAt.replaceAll(":", "-")}-${mode}.jsonl`);
  await writeFile(filename, `${JSON.stringify(result)}\n`, { flag: "wx" });
  process.stdout.write(`${filename}\n`);
} finally {
  await browser.close();
  await server.close();
}

function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function validateResult(result: Record<string, unknown>): void {
  const required = ["benchmarkVersion", "commit", "fixtureId", "startedAt", "device", "os", "browser", "configHash", "metrics", "exclusions", "unmeasurableCount", "artifactChecksums"];
  for (const key of required) if (!(key in result)) throw new Error(`result missing ${key}`);
  if (result.benchmarkVersion !== "camera-v1") throw new Error("invalid benchmark version");
}
