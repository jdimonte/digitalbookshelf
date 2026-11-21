import { useEffect, useState } from "react";
import { Apple, X } from "lucide-react";

export default function AuthModal({ initialData, onClose, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState({});
  const isRegistering = mode === "register";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/providers")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load sign-in providers.");
        return response.json();
      })
      .then(({ providers: availableProviders }) => {
        if (!cancelled) setProviders(availableProviders);
      })
      .catch((providerError) => {
        console.error("Could not load sign-in providers:", providerError);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSocialLogin = async (provider) => {
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/oauth/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialData }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Could not start social sign-in.");
      }
      window.location.assign(`/api/auth/${provider}`);
    } catch (requestError) {
      console.error("Could not start social sign-in:", requestError);
      setError(requestError.message || "Could not connect to the account service.");
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (isRegistering && password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${isRegistering ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(isRegistering ? { initialData } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Could not authenticate. Please try again.");
      }
      onAuthenticated(result.user);
    } catch (requestError) {
      console.error("Could not authenticate:", requestError);
      setError(requestError.message || "Could not connect to the account service.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="account-dialog-title"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-white p-6 text-stone-900 shadow-2xl"
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold" id="account-dialog-title">
              {isRegistering ? "Create your account" : "Log in"}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {isRegistering
                ? "Your current bookshelf will be saved to your account."
                : "Log in to load your bookshelf from your account."}
            </p>
          </div>
          <button
            aria-label="Close"
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 font-normal outline-none focus:border-stone-600 focus:ring-2 focus:ring-stone-300"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              autoComplete={isRegistering ? "new-password" : "current-password"}
              className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 font-normal outline-none focus:border-stone-600 focus:ring-2 focus:ring-stone-300"
              minLength={isRegistering ? 8 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {isRegistering && (
            <label className="block text-sm font-medium">
              Confirm password
              <input
                autoComplete="new-password"
                className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 font-normal outline-none focus:border-stone-600 focus:ring-2 focus:ring-stone-300"
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required
                type="password"
                value={passwordConfirmation}
              />
            </label>
          )}

          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

          <button
            className="w-full rounded-md bg-stone-800 px-4 py-2.5 font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Please wait..." : isRegistering ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-stone-500">
          <span className="h-px flex-1 bg-stone-200" />
          or continue with
          <span className="h-px flex-1 bg-stone-200" />
        </div>
        <div className="grid gap-2">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!providers.google || submitting}
            onClick={() => handleSocialLogin("google")}
            type="button"
          >
            <span aria-hidden="true" className="font-bold text-blue-600">G</span>
            Continue with Google
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!providers.apple || submitting}
            onClick={() => handleSocialLogin("apple")}
            type="button"
          >
            <Apple aria-hidden="true" className="h-4 w-4" />
            Continue with Apple
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!providers.facebook || submitting}
            onClick={() => handleSocialLogin("facebook")}
            type="button"
          >
            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">f</span>
            Continue with Facebook
          </button>
        </div>
        {!providers.google && !providers.apple && !providers.facebook && (
          <p className="mt-3 text-center text-xs text-stone-500">
            Social sign-in is unavailable until provider credentials are configured.
          </p>
        )}

        <p className="mt-5 text-center text-sm text-stone-600">
          {isRegistering ? "Already have an account?" : "New to the bookshelf?"}{" "}
          <button
            className="font-medium text-stone-900 underline underline-offset-2"
            onClick={() => {
              setMode(isRegistering ? "login" : "register");
              setError("");
            }}
            type="button"
          >
            {isRegistering ? "Log in" : "Create an account"}
          </button>
        </p>
      </section>
    </div>
  );
}
