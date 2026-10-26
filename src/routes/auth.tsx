import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · CareBuddy" },
      { name: "description", content: "Sign in to CareBuddy, your medicine and meal companion." },
      { property: "og:title", content: "Sign in · CareBuddy" },
      { property: "og:description", content: "Sign in to CareBuddy." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) return;
    // A caregiver invite opened before signing in continues here.
    const pending = sessionStorage.getItem("cb_invite");
    if (pending && /^[A-Za-z0-9_-]{32,128}$/.test(pending)) navigate({ to: "/caregiver-invite/$token", params: { token: pending } });
    else navigate({ to: "/" });
  }, [session, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    const { email: em, password: pw } = parsed.data;
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email: em,
            password: pw,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email: em, password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (mode === "signup" && !data.session) setSent(true);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Could not sign in with Google. Please try again.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-4xl font-bold text-primary">CareBuddy</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        A calm helper for your medicines, meals and how you feel.
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Check your email</h2>
          <p className="mt-2">We sent a link to {email}. Tap it to finish signing up.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">Email</Label>
            <Input id="email" type="email" autoComplete="email" className="h-12 text-base"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">Password</Label>
            <Input id="password" type="password" className="h-12 text-base"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={google}>
            Continue with Google
          </Button>
          <button type="button" className="min-h-11 w-full font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      )}

      <Link to="/emergency" className="mt-6 min-h-11 text-center font-semibold text-emergency underline">
        Need emergency help?
      </Link>
    </main>
  );
}
