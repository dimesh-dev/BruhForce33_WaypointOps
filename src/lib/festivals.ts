/** Display names for calendar.csv festival keys (e.g. "new_year"). */
const NAMES: Record<string, string> = {
  new_year: "Sinhala and Tamil New Year",
  thai_pongal: "Thai Pongal",
  vesak: "Vesak",
  poson: "Poson",
  esala: "Esala",
  deepavali: "Deepavali",
  christmas: "Christmas",
};

export function festivalName(key: string | null | undefined): string {
  if (!key) return "";
  return (
    NAMES[key.toLowerCase()] ??
    key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
