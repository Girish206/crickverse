// Shared formatting helpers for the projects/blog pages.

export function formatYear(date: string | null | undefined): string {
  if (!date) return "Present";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.getFullYear().toString();
}

export function formatFullDate(date: string | null | undefined): string {
  if (!date) return "Present";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function truncateText(text: string, length = 150): string {
  const trimmed = text.trim();
  if (trimmed.length <= length) return trimmed;
  return `${trimmed.slice(0, length).trim()}…`;
}

export function excerpt(content: string, length = 150): string {
  return truncateText(stripHtml(content), length);
}

export function readingTime(content: string): string {
  const words = stripHtml(content).trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

export function splitTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// "React Js" -> "RJ", "Python" -> "Py": a compact badge for a skill/tool.
export function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z0-9+#. ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const word = words[0] ?? "?";
  return word.length <= 3 ? word.toUpperCase() : word[0].toUpperCase() + word[1].toLowerCase();
}
