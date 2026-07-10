import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

const files = [
  ["index.html", "text/html; charset=utf-8"],
  ["styles.css", "text/css; charset=utf-8"],
  ["app.js", "application/javascript; charset=utf-8"],
  ["content-data.js", "application/javascript; charset=utf-8"],
  ["conjugation.html", "text/html; charset=utf-8"],
  ["conjugation.css", "text/css; charset=utf-8"],
  ["conjugation-app.js", "application/javascript; charset=utf-8"],
  ["conjugation-data.js", "application/javascript; charset=utf-8"],
  ["assets/grammar-map.svg", "image/svg+xml; charset=utf-8"]
];

const assets = {};
for (const [path, type] of files) {
  assets[`/${path}`] = {
    type,
    body: await readFile(join(root, path), "utf8")
  };
}
assets["/"] = assets["/index.html"];

const worker = `const assets = ${JSON.stringify(assets)};\n\nconst notFound = new Response("Not found", {\n  status: 404,\n  headers: { "content-type": "text/plain; charset=utf-8" }\n});\n\nexport default {\n  async fetch(request) {\n    const url = new URL(request.url);\n    const path = url.pathname.endsWith("/") && url.pathname !== "/" ? url.pathname.slice(0, -1) : url.pathname;\n    const asset = assets[path] || assets[path + ".html"];\n\n    if (!asset) return notFound;\n\n    return new Response(asset.body, {\n      headers: {\n        "content-type": asset.type,\n        "cache-control": "public, max-age=300"\n      }\n    });\n  }\n};\n`;

await mkdir(join(dist, "server"), { recursive: true });
await writeFile(join(dist, "server", "index.js"), worker);
await writeFile(
  join(dist, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), files: files.map(([path]) => path) }, null, 2)
);

console.log("Built static site for Sites hosting.");
