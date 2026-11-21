import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function AuthModal({ initialData, onClose, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, setProviders] = useState({});
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
  void handleSocialLogin;

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
            <h2
              className="text-2xl font-bold"
              id="account-dialog-title"
              style={{ color: "#654321" }}
            >
              {isRegistering ? "Create your account" : "Log in"}
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: "#654321" }}
            >
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

        <p className="mt-5 text-center text-sm text-stone-600">
          {isRegistering ? "Already have an account?" : "New to the bookshelf?"}{" "}
          <button
            className="font-medium text-stone-900"
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
