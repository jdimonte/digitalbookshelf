# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# bookshelf

## MongoDB accounts

The bookshelf stays usable without an account and is saved in this browser. Use
the **Log in** button at the top right to sign in or create an account. Creating
an account imports the current browser bookshelf; signing in loads that
account's bookshelf from MongoDB.

Add these settings to the ignored `.env.local` file in the project root:

- `MONGODB_URI`: your MongoDB connection string.
- `MONGODB_DB`: database name (optional if the URI already selects a database).
- `SESSION_SECRET`: a private random value of at least 32 characters. Generate
  one with `openssl rand -base64 48`.

Never add `VITE_` to these variables or expose the MongoDB URI in frontend code.
The API uses an HTTP-only session cookie and stores password hashes, account
details, and bookshelf data in MongoDB.

Run the API and frontend in separate terminals:

```sh
npm run dev:api
npm run dev
```

For production, build the frontend with `npm run build`, then start the API with
`NODE_ENV=production npm start`.

### Social sign-in providers

The login dialog includes Google, Apple, and Facebook. Each provider stays
disabled until its server-side credentials are configured. Register the
following callback URLs in each provider's developer console:

- Google: `${APP_ORIGIN}/api/auth/google/callback`
- Apple: `${APP_ORIGIN}/api/auth/apple/callback`
- Facebook: `${APP_ORIGIN}/api/auth/facebook/callback`

Set the corresponding client IDs/secrets in `.env.local`; Apple also needs its
Team ID, key ID, and the path to its `.p8` private key. Apple requires an HTTPS
callback URL, so local Apple testing needs a public HTTPS development URL
registered with Apple. Set `APP_ORIGIN` to the exact origin the browser uses.
The expected variable names are listed in `.env.example`; copy those provider
settings into `.env.local` after creating each provider application. The
buttons remain disabled until a provider is configured.

Social identities are not automatically linked to an existing password
account, even when their email addresses match. Sign in with the existing method
first; this avoids accidentally linking an account based only on an email claim.
