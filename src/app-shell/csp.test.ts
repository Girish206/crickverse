import { it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// vercel.json's Content-Security-Policy allows index.html's inline splash
// script and the font stylesheet's onload by their hashes. Editing either
// changes its hash: this fails until the new one is put in vercel.json.

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const sha = (text: string) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;

it("allows every inline script in index.html by its hash", () => {
  const html = read("index.html");
  const vercel = JSON.parse(read("vercel.json")) as { headers: { headers: { key: string; value: string }[] }[] };
  const csp = vercel.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key.startsWith("Content-Security-Policy"))?.value;
  assert.ok(csp, "vercel.json sets a Content-Security-Policy");
  const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src")) ?? "";

  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const handlers = [...html.matchAll(/\son\w+="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(inline.length > 0);
  for (const code of [...inline, ...handlers]) {
    assert.ok(scriptSrc.includes(sha(code)), `script-src is missing ${sha(code)}`);
  }
});
