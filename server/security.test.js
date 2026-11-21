import process from "node:process";
import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  isValidPassword,
  normalizeEmail,
  normalizeUserData,
  verifyPassword,
} from "./security.js";
import { createAuthorizationUrl, createOAuthFlow } from "./oauth.js";

test("normalizes valid emails and rejects malformed ones", () => {
  assert.equal(normalizeEmail(" Reader@Example.com "), "reader@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
});

test("enforces password length and verifies salted password hashes", async () => {
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);

  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword(password), true);
  assert.notEqual(hash, await hashPassword(password));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("accepts bookshelf data and rejects invalid persisted state", () => {
  assert.deepEqual(normalizeUserData({ shelves: [], shelfCount: 5 }), {
    shelves: [],
    stackTops: {},
    shelfCount: 5,
    theme: null,
    goodreadsBooks: [],
  });
  assert.equal(normalizeUserData({ shelfCount: 0 }), null);
  assert.equal(normalizeUserData(null), null);
});

test("creates Google, Apple, and Facebook authorization requests", () => {
  const keys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY_PATH",
    "FACEBOOK_APP_ID",
    "FACEBOOK_APP_SECRET",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.APPLE_CLIENT_ID = "test-apple-client";
  process.env.APPLE_TEAM_ID = "test-team";
  process.env.APPLE_KEY_ID = "test-key";
  process.env.APPLE_PRIVATE_KEY_PATH = "AuthKey.p8";
  process.env.FACEBOOK_APP_ID = "test-facebook-client";
  process.env.FACEBOOK_APP_SECRET = "test-facebook-secret";

  try {
    for (const provider of ["google", "apple", "facebook"]) {
      const flow = createOAuthFlow();
      const authorizationUrl = new URL(
        createAuthorizationUrl(
          provider,
          flow,
          `http://localhost:5173/api/auth/${provider}/callback`,
        ),
      );
      assert.equal(authorizationUrl.searchParams.get("state"), flow.state);
      if (provider !== "facebook") {
        assert.equal(authorizationUrl.searchParams.get("nonce"), flow.nonce);
      }
      if (provider === "google") {
        assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
        assert.ok(authorizationUrl.searchParams.get("code_challenge"));
      }
      if (provider === "apple") {
        assert.equal(authorizationUrl.searchParams.get("response_mode"), "query");
      }
      if (provider === "facebook") {
        assert.ok(authorizationUrl.pathname.includes("/dialog/oauth"));
      }
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
