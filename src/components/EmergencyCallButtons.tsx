import { Phone, Ambulance } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmergencyCallButtons() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button asChild variant="emergency" size="lg" className="w-full">
        <a href="tel:112" aria-label="Call 112, general emergency">
          <Phone /> Call 112 · Emergency
        </a>
      </Button>
      <Button asChild variant="emergency" size="lg" className="w-full">
        <a href="tel:108" aria-label="Call 108, ambulance">
          <Ambulance /> Call 108 · Ambulance
        </a>
      </Button>
    </div>
  );
}
