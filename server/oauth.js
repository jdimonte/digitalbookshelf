import { createHash, randomBytes, createPrivateKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const appleKeys = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

export function getOAuthProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(
      process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY_PATH
    ),
    facebook: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
  };
}

export function createOAuthFlow() {
  const state = randomBytes(32).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  return { state, nonce, codeVerifier, codeChallenge, createdAt: Date.now() };
}

export function createAuthorizationUrl(provider, flow, callbackUrl) {
  const providers = getOAuthProviders();
  if (!providers[provider]) throw new Error(`${provider} sign-in is not configured.`);

  const parameters = new URLSearchParams({
    client_id: provider === "facebook"
      ? process.env.FACEBOOK_APP_ID
      : provider === "apple"
        ? process.env.APPLE_CLIENT_ID
        : process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: "code",
    state: flow.state,
  });

  if (provider === "google") {
    parameters.set("scope", "openid email profile");
    parameters.set("nonce", flow.nonce);
    parameters.set("code_challenge", flow.codeChallenge);
    parameters.set("code_challenge_method", "S256");
    parameters.set("prompt", "select_account");
    return `https://accounts.google.com/o/oauth2/v2/auth?${parameters}`;
  }

  if (provider === "apple") {
    parameters.set("scope", "name email");
    parameters.set("nonce", flow.nonce);
    parameters.set("response_mode", "query");
    return `https://appleid.apple.com/auth/authorize?${parameters}`;
  }

  parameters.set("scope", "email,public_profile");
  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v24.0";
  return `https://www.facebook.com/${graphVersion}/dialog/oauth?${parameters}`;
}

async function postForm(url, parameters, provider) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
  });
  if (!response.ok) throw new Error(`${provider} sign-in could not be completed.`);
  return response.json();
}

async function verifyGoogleIdentity(idToken, flow) {
  const { payload } = await jwtVerify(idToken, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  if (payload.nonce !== flow.nonce || typeof payload.sub !== "string") {
    throw new Error("Google identity validation failed.");
  }
  return {
    id: payload.sub,
    email: payload.email_verified === true ? payload.email : undefined,
    displayName: payload.name,
  };
}

async function verifyAppleIdentity(idToken, flow) {
  const { payload } = await jwtVerify(idToken, appleKeys, {
    issuer: "https://appleid.apple.com",
    audience: process.env.APPLE_CLIENT_ID,
  });
  if (payload.nonce !== flow.nonce || typeof payload.sub !== "string") {
    throw new Error("Apple identity validation failed.");
  }
  return {
    id: payload.sub,
    email: payload.email,
  };
}

async function createAppleClientSecret() {
  const keyPath = path.resolve(process.cwd(), process.env.APPLE_PRIVATE_KEY_PATH);
  const privateKey = createPrivateKey(await readFile(keyPath));
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID })
    .setIssuer(process.env.APPLE_TEAM_ID)
    .setSubject(process.env.APPLE_CLIENT_ID)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

export async function exchangeOAuthCode(provider, code, flow, callbackUrl) {
  if (provider === "google") {
    const tokens = await postForm(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
        code_verifier: flow.codeVerifier,
      },
      "Google",
    );
    if (typeof tokens.id_token !== "string") {
      throw new Error("Google did not return an identity token.");
    }
    return verifyGoogleIdentity(tokens.id_token, flow);
  }

  if (provider === "apple") {
    const tokens = await postForm(
      "https://appleid.apple.com/auth/token",
      {
        code,
        client_id: process.env.APPLE_CLIENT_ID,
        client_secret: await createAppleClientSecret(),
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      },
      "Apple",
    );
    if (typeof tokens.id_token !== "string") {
      throw new Error("Apple did not return an identity token.");
    }
    return verifyAppleIdentity(tokens.id_token, flow);
  }

  if (provider === "facebook") {
    const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v24.0";
    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri: callbackUrl,
      code,
    }).toString();
    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) throw new Error("Facebook sign-in could not be completed.");
    const tokens = await tokenResponse.json();
    if (typeof tokens.access_token !== "string") {
      throw new Error("Facebook did not return an access token.");
    }

    const profileUrl = new URL(`https://graph.facebook.com/${graphVersion}/me`);
    profileUrl.search = new URLSearchParams({
      fields: "id,name,email",
      access_token: tokens.access_token,
    }).toString();
    const profileResponse = await fetch(profileUrl);
    if (!profileResponse.ok) throw new Error("Could not load the Facebook profile.");
    const profile = await profileResponse.json();
    if (typeof profile.id !== "string") {
      throw new Error("Facebook did not return a user ID.");
    }
    return { id: profile.id, email: profile.email, displayName: profile.name };
  }

  throw new Error("Unknown sign-in provider.");
}
