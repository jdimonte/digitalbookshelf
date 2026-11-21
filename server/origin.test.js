import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "./origin.js";

test("allows the configured frontend origin through the API proxy", () => {
  assert.equal(isAllowedOrigin("http://localhost:5173", "http://localhost:5173"), true);
});

test("rejects a request from an unconfigured origin", () => {
  assert.equal(isAllowedOrigin("https://attacker.example", "http://localhost:5173"), false);
});

test("allows requests without an Origin header", () => {
  assert.equal(isAllowedOrigin(undefined, "http://localhost:5173"), true);
});
