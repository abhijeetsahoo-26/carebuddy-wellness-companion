import { Phone, Ambulance, Flame, Shield, HeartHandshake, Baby, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDirectory } from "@/hooks/useDirectory";
import { telHref } from "@/lib/directory";

const ICON: Record<string, typeof Phone> = { emergency: Phone, ambulance_108: Ambulance, ambulance_102: Ambulance, fire: Flame, police: Shield, women: Users, child: Baby, mental_health: HeartHandshake };

// One-tap buttons that open the phone dialer. The app never dials by itself.
export function EmergencyDirectory() {
  const { list } = useDirectory();
  const [first, ...rest] = list;
  return (
    <div className="space-y-3">
      {first && (
        <Button asChild variant="emergency" className="h-auto min-h-20 w-full whitespace-normal py-4 text-xl sm:text-2xl">
          <a href={telHref(first.number)} aria-label={`Call ${first.number}, ${first.label}`}><Phone className="size-8" /> Call {first.number} · {first.label}</a>
        </Button>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {rest.map((d) => {
          const Icon = ICON[d.key] ?? Phone;
          return (
            <Button key={d.key} asChild variant={d.key.startsWith("ambulance") ? "emergency" : "outline"} size="lg" className="h-auto min-h-14 w-full justify-start whitespace-normal py-3 text-left">
              <a href={telHref(d.number)} aria-label={`Call ${d.number}, ${d.label}`}><Icon /> {d.number} · {d.label}</a>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
