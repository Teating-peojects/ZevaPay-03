/**
 * Browser download helpers.
 *
 * Used by the CSV export buttons. The file is generated in the browser and
 * handed to the user as a download — nothing is uploaded anywhere.
 */

/**
 * Downloads a string as a file.
 */
export function downloadTextFile(
  filename: string,
  contents: string,
  mimeType = "text/csv;charset=utf-8",
) {
  if (typeof window === "undefined") return;

  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Give the browser a tick to start the download before revoking the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Downloads a CSV file with the given rows.
 *
 * The header row comes first, then each row's cells. Values containing a
 * comma, a quote or a newline are quoted, and inner quotes are doubled.
 */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    header.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  downloadTextFile(filename, `${lines.join("\n")}\n`);
}

/**
 * A filename stamp for exports, e.g. `2026-11-02`.
 */
export function exportDateStamp(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
