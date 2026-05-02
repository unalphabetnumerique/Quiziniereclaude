"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

function tryCreateClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export function AuthBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const supabase = tryCreateClient();
    if (!supabase) {
      setConfigured(false);
      setReady(true);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = tryCreateClient();
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    router.refresh();
    setUser(null);
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-3 text-sm text-white/70">…</div>
    );
  }

  if (!configured) {
    return (
      <span className="max-w-xs text-right text-xs text-amber-100">
        Configure NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY
      </span>
    );
  }

  if (user) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="max-w-[200px] truncate text-slate-700" title={user.email}>
          {user.email}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 font-medium text-white backdrop-blur hover:bg-white/20"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
    >
      Connexion
    </Link>
  );
}
