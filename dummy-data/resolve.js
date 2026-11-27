import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fs.realpathSync.native(
  path.dirname(fileURLToPath(import.meta.url)),
);

const inRoot = (target) => target.startsWith(ROOT + path.sep);

const exactCase = (target) => {
  let current = ROOT;
  for (const segment of path.relative(ROOT, target).split(path.sep)) {
    if (!fs.readdirSync(current).includes(segment)) {
      return false;
    }
    current = path.join(current, segment);
  }
  return true;
};

const exists = (target, kind) => {
  try {
    return (
      inRoot(target) &&
      inRoot(fs.realpathSync.native(target)) &&
      exactCase(target) &&
      fs.statSync(target)[kind]()
    );
  } catch {
    return false;
  }
};

const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export default function resolveMock(url, { method = "GET", body = "" } = {}) {
  const { pathname } = new URL(url, "http://mock");
  const relative =
    pathname.startsWith("/dummy-data/") &&
    decode(pathname.slice("/dummy-data/".length));
  if (!relative) {
    return null;
  }

  const target = path.join(ROOT, relative);
  const trailingSlash = target.endsWith(path.sep);
  const base = trailingSlash ? target.slice(0, -1) : target;

  if (exists(base, "isFile")) {
    return trailingSlash ? null : base;
  }

  if (!exists(base, "isDirectory")) {
    return null;
  }

  const rpcMethod =
    method === "POST" &&
    body.match(/<methodName>\s*([^<\s]+)\s*<\/methodName>/)?.[1];
  const candidates = [
    rpcMethod && path.join(base, rpcMethod),
    path.join(base, "index.html"),
  ];
  return candidates.find((file) => file && exists(file, "isFile")) ?? null;
}
