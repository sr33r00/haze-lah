import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, createLimiter } from "@/lib/rateLimit";

test("limits an IP after its allowance, and lets it back in once the window passes", () => {
  const limited = createLimiter(1000, 2);
  assert.equal(limited("a", 0), false);
  assert.equal(limited("a", 10), false);
  assert.equal(limited("a", 20), true);
  assert.equal(limited("b", 20), false);
  assert.equal(limited("a", 5000), false);
});

test("reads the caller's IP from Cloudflare's header, then x-forwarded-for", () => {
  assert.equal(clientIp(new Request("https://x", { headers: { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" } })), "1.1.1.1");
  assert.equal(clientIp(new Request("https://x", { headers: { "x-forwarded-for": "2.2.2.2, 3.3.3.3" } })), "2.2.2.2");
  assert.equal(clientIp(new Request("https://x")), "unknown");
});

