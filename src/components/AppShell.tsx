import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Home, Pill, Utensils, ClipboardList, MoreHorizontal, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/useAccount";
import { ErrorState, LoadingState } from "@/components/States";

const tabs = [
  { to: "/", label: "Today", icon: Home },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/meals", label: "Meals", icon: Utensils },
  { to: "/plan", label: "Plan", icon: ClipboardList },
  { to: "/more", label: "More", icon: MoreHorizontal },
] as const;

type Gate = "full" | "signed-in";

/** Signed-in screens. "full" also requires consent and finished onboarding. */
export function useGate(gate: Gate = "full") {
  const acc = useAccount();
  const navigate = useNavigate();
  const { user, authLoading, data, isLoading } = acc;

  useEffect(() => {
    if (authLoading) return;
    if (!user) return void navigate({ to: "/auth" });
    if (gate === "signed-in" || isLoading || !data) return;
    if (!data.consent) navigate({ to: "/consent" });
    else if (!data.profile?.onboarding_done) navigate({ to: "/onboarding" });
  }, [authLoading, user, data, isLoading, gate, navigate]);

  const ready =
    !!user && !!data && (gate === "signed-in" || (!!data.consent && !!data.profile?.onboarding_done));
  return { ...acc, ready };
}

export function AppShell({ children }: { children: ReactNode }) {
  const g = useGate("full");
  if (g.error) return <main className="mx-auto max-w-xl p-5"><ErrorState error={g.error} onRetry={() => g.refetch()} /></main>;
  if (!g.ready) return <LoadingState />;

  return (
    <div className="mx-auto min-h-screen max-w-xl px-5 pb-48 pt-8">
      {children}
      <p className="mt-10 text-center text-sm text-muted-foreground">
        CareBuddy is not a doctor or emergency service.
      </p>
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pt-3">
          <Button asChild variant="emergency" size="lg" className="w-full">
            <Link to="/emergency"><Siren /> Emergency help</Link>
          </Button>
        </div>
        <nav aria-label="Main" className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-sm text-muted-foreground data-[status=active]:font-bold data-[status=active]:text-primary"
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <header>
      <h1 className="text-3xl font-bold">{title}</h1>
      {sub && <p className="mt-1 text-lg text-muted-foreground">{sub}</p>}
    </header>
  );
}
