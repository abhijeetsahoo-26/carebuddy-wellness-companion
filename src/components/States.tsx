import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { friendlyMessage } from "@/lib/errors";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="py-12 text-center text-muted-foreground">
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border bg-card p-6 text-center">
      <p className="text-lg">{friendlyMessage(error)}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children && <div className="mt-2 text-muted-foreground">{children}</div>}
    </div>
  );
}
