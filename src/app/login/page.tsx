"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback`
        }
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setMessage(
        "Vérifie ta boîte mail : un lien de connexion vient d’être envoyé."
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 bg-slate-50 px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">
          Saisis ton e-mail pour recevoir un lien magique (sans mot de passe).
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">E-mail</span>
            <input
              required
              type="email"
              autoComplete="email"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="toi@exemple.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? "Envoi…" : "Recevoir le lien"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/" className="font-medium text-blue-600 hover:underline">
            Retour à l’accueil
          </Link>
        </p>
      </div>
    </main>
  );
}
