"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    router.push("/map");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-border bg-card p-8"
      >
        <h1 className="mb-1 text-lg font-semibold text-text-primary">Hedge Fund Dashboard</h1>
        <p className="mb-6 text-sm text-text-secondary">Terminal propriétaire</p>

        <label className="mb-1 block text-xs text-text-secondary">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-button border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-link"
        />

        <label className="mb-1 block text-xs text-text-secondary">Mot de passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-button border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-link"
        />

        {error && <p className="mb-4 text-sm text-bear">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-button bg-link py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
