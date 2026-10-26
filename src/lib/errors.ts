import { toast } from "sonner";

// Central place that turns any error into a calm, plain message.
export function friendlyMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = raw.toLowerCase();
  if (m.includes("failed to fetch") || m.includes("network")) return "You seem to be offline. Please check your internet and try again.";
  if (m.includes("unauthorized") || m.includes("jwt")) return "Please sign in again.";
  if (m.includes("row-level security") || m.includes("permission")) return "Please finish the privacy step first.";
  if (m.includes("invalid login")) return "That email or password didn't match. Please try again.";
  if (raw && raw.length < 120 && !m.includes("sql") && !m.includes("violates")) return raw;
  return "Something went wrong. Please try again.";
}

export function showError(err: unknown) {
  console.error(err);
  toast.error(friendlyMessage(err));
}
