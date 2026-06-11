import { createClient } from "@supabase/supabase-js";

// Browser-side auth client — uses anon key, manages session in localStorage
export function getAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}

// Get the current session (client-side only)
export async function getSession() {
  const { data } = await getAuthClient().auth.getSession();
  return data?.session ?? null;
}

// Get the current user (client-side only)
export async function getUser() {
  const { data } = await getAuthClient().auth.getUser();
  return data?.user ?? null;
}

// Sign in with Google — redirects to Google consent screen
export async function signInWithGoogle() {
  const { error } = await getAuthClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: "openid email profile",
    },
  });
  if (error) throw error;
}

// Sign out
export async function signOut() {
  await getAuthClient().auth.signOut();
}
