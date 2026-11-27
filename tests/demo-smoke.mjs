import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";
import { parse } from "yaml";

const PORT = 4173;
const ADDRESS = `http://127.0.0.1:${PORT}/`;
const CHROME = process.env.CHROME_BIN || "google-chrome";

const demo = parse(
  readFileSync(new URL("../dummy-data/demo.yml", import.meta.url), "utf8"),
);
const expected = demo.services.flatMap((group) => group.items).length;

const server = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
    "preview",
    "--mode",
    "demo",
    "--host",
    "127.0.0.1",
    "--port",
    String(PORT),
    "--strictPort",
  ],
  { stdio: "inherit" },
);

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`vite preview exited with ${server.exitCode}`);
    }
    const ready = await fetch(ADDRESS).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`vite preview did not answer on ${ADDRESS}`);
};

const render = async () => {
  const { stdout } = await promisify(execFile)(
    CHROME,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      "--virtual-time-budget=15000",
      "--dump-dom",
      ADDRESS,
    ],
    { maxBuffer: 64 * 1024 * 1024, timeout: 120000 },
  );
  return new JSDOM(stdout).window.document;
};

const check = (document) => {
  const failures = [];
  const text = document.body.textContent;
  const cardName = (element) =>
    element.closest(".card")?.querySelector(".title")?.textContent.trim();

  for (const error of [
    "No configuration found",
    "Error loading configuration",
  ]) {
    if (text.includes(error)) {
      failures.push(error);
    }
  }

  const cards = document.querySelectorAll(".card").length;
  if (cards < expected) {
    failures.push(`${cards} cards rendered, demo.yml lists ${expected}`);
  }

  for (const status of document.querySelectorAll(".status.offline")) {
    if (status.textContent.trim() === "offline") {
      failures.push(`${cardName(status)}: offline`);
    }
  }

  for (const badge of document.querySelectorAll(
    '.badge[title^="Connection error"]',
  )) {
    failures.push(`${cardName(badge)}: connection error`);
  }

  for (const element of document.querySelectorAll(".component-error")) {
    failures.push(`${cardName(element) ?? "a card"}: failed to load`);
  }

  return { failures, cards };
};

try {
  await waitForServer();
  const { failures, cards } = check(await render());
  if (failures.length) {
    console.error(`Demo smoke test failed:\n- ${failures.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log(`Demo smoke test passed: ${cards} cards, every one loaded.`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill();
}
