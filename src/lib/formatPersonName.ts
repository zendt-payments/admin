/** Title-case a person's name for display (handles ALL CAPS or mixed storage). */
export function formatPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ");
}
