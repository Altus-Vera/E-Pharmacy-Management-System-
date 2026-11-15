/** Extract a readable message from an axios/API error. */
export function apiError(e: unknown, fallback = "Something went wrong"): string {
  const err = e as { response?: { data?: { detail?: string; title?: string; errors?: Record<string, string[]> } | string }; message?: string };
  const d = err?.response?.data;
  if (typeof d === "string" && d) return d;
  if (d && typeof d === "object") {
    if (d.detail) return d.detail;
    if (d.errors) return Object.values(d.errors).flat().join(" ");
    if (d.title) return d.title;
  }
  return err?.message || fallback;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function exportCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map(r => r.map(v => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
