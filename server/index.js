import process from "node:process";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { rateLimit } from "express-rate-limit";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { MongoClient, ObjectId } from "mongodb";
import {
  hashPassword,
  isValidPassword,
  normalizeEmail,
  normalizeUserData,
  verifyPassword,
} from "./security.js";
import {
  createAuthorizationUrl,
  createOAuthFlow,
  exchangeOAuthCode,
  getOAuthProviders,
} from "./oauth.js";
import { isAllowedOrigin } from "./origin.js";

const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;

if (!mongoUri) {
  throw new Error("MONGODB_URI is required. Add it to .env.local.");
}
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters. Add it to .env.local.");
}

const app = express();
const mongoClient = new MongoClient(mongoUri);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appOrigin = new URL(process.env.APP_ORIGIN || "http://localhost:5173").origin;

app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "https://openlibrary.org"],
        imgSrc: ["'self'", "data:", "https://covers.openlibrary.org"],
        fontSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (!isAllowedOrigin(origin, appOrigin)) {
      return res.status(403).json({ error: "Cross-origin request rejected." });
    }
  }
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

function regenerateSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.user = {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
      };
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function isMatchingState(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string") return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes);
}

function redirectOAuthError(res, error) {
  const target = new URL("/", appOrigin);
  target.searchParams.set("authError", error);
  res.redirect(target.toString());
}

async function findOrCreateOAuthUser(users, provider, identity, initialData) {
  const providerField = `oauth.${provider}`;
  const existing = await users.findOne({ [providerField]: identity.id });
  if (existing) return existing;

  const email = normalizeEmail(identity.email);
  if (!email) throw new Error("email_required");
  if (await users.findOne({ email })) throw new Error("account_exists");

  const user = {
    email,
    displayName: typeof identity.displayName === "string" ? identity.displayName : "",
    oauth: { [provider]: identity.id },
    data: initialData || normalizeUserData({}),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const { insertedId } = await users.insertOne(user);
    user._id = insertedId;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const providerUser = await users.findOne({ [providerField]: identity.id });
    if (providerUser) return providerUser;
    throw new Error("account_exists", { cause: error });
  }
  return user;
}

function requireUser(req, res, next) {
  const userId = req.session.user?.id;
  if (!userId || !ObjectId.isValid(userId)) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  req.userId = new ObjectId(userId);
  next();
}

function clearSession(req, res) {
  req.session.destroy((error) => {
    if (error) {
      console.error("Could not destroy session:", error);
      return res.status(500).json({ error: "Could not sign out. Please try again." });
    }
    res.clearCookie("bookshelf.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.status(204).end();
  });
}

async function start() {
  await mongoClient.connect();
  const database = mongoClient.db(process.env.MONGODB_DB || undefined);
  const users = database.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
  const dummyPasswordHash = await hashPassword("bookshelf-invalid-login-password");

  app.use(
    session({
      name: "bookshelf.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoClient,
        dbName: database.databaseName,
        collectionName: "sessions",
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.session.user ?? null });
  });

  app.get("/api/auth/providers", (_req, res) => {
    res.json({ providers: getOAuthProviders() });
  });

  app.post("/api/auth/oauth/prepare", async (req, res) => {
    const data = normalizeUserData(req.body?.initialData);
    if (!data) return res.status(400).json({ error: "The bookshelf data is invalid." });
    req.session.oauthInitialData = data;
    await saveSession(req);
    res.status(204).end();
  });

  app.get("/api/auth/:provider", async (req, res) => {
    const { provider } = req.params;
    if (!["google", "apple", "facebook"].includes(provider)) {
      return res.status(404).json({ error: "Unknown sign-in provider." });
    }
    if (!getOAuthProviders()[provider]) {
      return res.status(503).json({ error: `${provider} sign-in is not configured.` });
    }

    const flow = { ...createOAuthFlow(), provider };
    req.session.oauthFlow = flow;
    await saveSession(req);
    const callbackUrl = `${appOrigin}/api/auth/${provider}/callback`;
    res.redirect(createAuthorizationUrl(provider, flow, callbackUrl));
  });

  app.get("/api/auth/:provider/callback", async (req, res) => {
    const { provider } = req.params;
    const flow = req.session.oauthFlow;
    if (
      !["google", "apple", "facebook"].includes(provider) ||
      flow?.provider !== provider ||
      Date.now() - flow.createdAt > 10 * 60 * 1000 ||
      !isMatchingState(req.query.state, flow.state)
    ) {
      return redirectOAuthError(res, "provider_error");
    }

    if (req.query.error || typeof req.query.code !== "string") {
      req.session.oauthFlow = null;
      req.session.oauthInitialData = null;
      await saveSession(req);
      return redirectOAuthError(res, "provider_error");
    }

    const initialData = req.session.oauthInitialData;
    req.session.oauthFlow = null;
    req.session.oauthInitialData = null;
    await saveSession(req);

    try {
      const callbackUrl = `${appOrigin}/api/auth/${provider}/callback`;
      const identity = await exchangeOAuthCode(provider, req.query.code, flow, callbackUrl);
      const user = await findOrCreateOAuthUser(users, provider, identity, initialData);
      await regenerateSession(req, user);
      res.redirect(`${appOrigin}/`);
    } catch (error) {
      console.error(`Could not complete ${provider} sign-in:`, error);
      redirectOAuthError(
        res,
        error.message === "account_exists" || error.message === "email_required"
          ? error.message
          : "provider_error",
      );
    }
  });

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const data = normalizeUserData(req.body?.initialData);

    if (!email) return res.status(400).json({ error: "Enter a valid email address." });
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: "Password must be between 8 and 128 characters." });
    }
    if (!data) return res.status(400).json({ error: "The bookshelf data is invalid." });

    const user = {
      email,
      passwordHash: await hashPassword(password),
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const { insertedId } = await users.insertOne(user);
      user._id = insertedId;
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: "An account with that email already exists." });
      }
      throw error;
    }

    await regenerateSession(req, user);
    res.status(201).json({
      user: { id: user._id.toString(), email: user.email },
    });
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== "string" || password.length > 128) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    const user = await users.findOne({ email });
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash || dummyPasswordHash,
    );
    if (!user || !passwordMatches) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    await regenerateSession(req, user);
    res.json({ user: { id: user._id.toString(), email: user.email } });
  });

  app.post("/api/auth/logout", requireUser, clearSession);

  app.get("/api/bookshelf", requireUser, async (req, res) => {
    const user = await users.findOne(
      { _id: req.userId },
      { projection: { data: 1 } },
    );
    if (!user) return res.status(401).json({ error: "Please sign in to continue." });
    res.json({ data: user.data });
  });

  app.put("/api/bookshelf", requireUser, async (req, res) => {
    const data = normalizeUserData(req.body?.data);
    if (!data) return res.status(400).json({ error: "The bookshelf data is invalid." });

    const result = await users.updateOne(
      { _id: req.userId },
      { $set: { data, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }
    res.status(204).end();
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));

  if (process.env.NODE_ENV === "production") {
    const clientDist = path.resolve(__dirname, "../dist");
    app.use(express.static(clientDist));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use((error, _req, res, next) => {
    console.error("Request failed:", error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => {
    console.log(`Bookshelf API listening on port ${port}`);
  });
}

start().catch(async (error) => {
  console.error("Could not start the Bookshelf API:", error);
  await mongoClient.close();
  process.exitCode = 1;
});
