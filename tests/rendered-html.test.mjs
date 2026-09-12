import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares Russian storefront metadata", async () => {
  const source = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(source, /<html lang="ru">/);
  assert.match(source, /title:\s*"Джентельмен — цветочная мастерская"/);
  assert.match(source, /description:\s*"Свежие букеты/);
  assert.match(source, /icon:\s*"\/favicon\.svg"/);
});
