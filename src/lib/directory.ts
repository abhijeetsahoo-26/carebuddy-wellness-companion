// Built-in copy of the default numbers, used if the saved list can't load, so Emergency always works.
export type DirEntry = { key: string; label: string; number: string; sort: number; edited?: boolean };
export const DEFAULT_DIRECTORY: DirEntry[] = [
  { key: "emergency", label: "Police, fire, ambulance", number: "112", sort: 0 },
  { key: "ambulance_108", label: "Ambulance", number: "108", sort: 1 },
  { key: "ambulance_102", label: "Ambulance (102)", number: "102", sort: 2 },
  { key: "fire", label: "Fire", number: "101", sort: 3 },
  { key: "police", label: "Police", number: "100", sort: 4 },
  { key: "women", label: "Women helpline", number: "1091", sort: 5 },
  { key: "child", label: "Child helpline", number: "1098", sort: 6 },
  { key: "mental_health", label: "Mental health support (Tele-MANAS)", number: "14416", sort: 7 },
];

export function mergeDirectory(rows: { key: string; label: string; number: string; sort: number; user_id: string | null }[]): DirEntry[] {
  const map = new Map<string, DirEntry>();
  for (const r of rows.filter((r) => r.user_id === null)) map.set(r.key, { key: r.key, label: r.label, number: r.number, sort: r.sort });
  for (const r of rows.filter((r) => r.user_id !== null)) map.set(r.key, { key: r.key, label: r.label, number: r.number, sort: map.get(r.key)?.sort ?? r.sort, edited: true });
  const list = [...map.values()].sort((a, b) => a.sort - b.sort);
  return list.length ? list : DEFAULT_DIRECTORY;
}

export const telHref = (n: string) => `tel:${n.replace(/[^0-9+]/g, "")}`;
