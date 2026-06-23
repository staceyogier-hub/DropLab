/**
 * Platform file I/O. When running inside the Tauri desktop shell, use native
 * open/save dialogs (via the global `window.__TAURI__`, enabled with
 * `withGlobalTauri`). Otherwise fall back to browser download / file input.
 *
 * No Tauri npm package is bundled, so the web build stays free of native code
 * and makes no network calls.
 */

// Minimal typing of the Tauri global surface we use — avoids `any`.
interface TauriDialog {
  save(opts?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>;
  open(opts?: {
    multiple?: boolean;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | string[] | null>;
}
interface TauriFs {
  writeTextFile(path: string, contents: string): Promise<void>;
  writeFile(path: string, contents: Uint8Array): Promise<void>;
  readTextFile(path: string): Promise<string>;
}
interface TauriGlobal {
  dialog: TauriDialog;
  fs: TauriFs;
}

function tauri(): TauriGlobal | null {
  const g = globalThis as unknown as { __TAURI__?: TauriGlobal };
  return g.__TAURI__ ?? null;
}

export function isDesktop(): boolean {
  return tauri() !== null;
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1) : 'txt';
}

function browserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Save text, via a native Save dialog on desktop or a browser download. */
export async function saveText(filename: string, text: string, mime = 'text/plain'): Promise<void> {
  const t = tauri();
  if (t) {
    const path = await t.dialog.save({
      defaultPath: filename,
      filters: [{ name: extOf(filename).toUpperCase(), extensions: [extOf(filename)] }],
    });
    if (path) await t.fs.writeTextFile(path, text);
    return;
  }
  browserDownload(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

/** Save bytes (e.g. XLSX), native or browser. */
export async function saveBytes(
  filename: string,
  bytes: Uint8Array,
  mime = 'application/octet-stream',
): Promise<void> {
  const t = tauri();
  if (t) {
    const path = await t.dialog.save({
      defaultPath: filename,
      filters: [{ name: extOf(filename).toUpperCase(), extensions: [extOf(filename)] }],
    });
    if (path) await t.fs.writeFile(path, bytes);
    return;
  }
  browserDownload(new Blob([bytes as BlobPart], { type: mime }), filename);
}

export interface OpenedFile {
  name: string;
  text: string;
}

/**
 * Open a text file. On desktop this uses the native Open dialog; on the web it
 * resolves null and the caller should use a normal <input type="file"> instead.
 */
export async function openTextFileNative(
  filters: { name: string; extensions: string[] }[],
): Promise<OpenedFile | null> {
  const t = tauri();
  if (!t) return null;
  const picked = await t.dialog.open({ multiple: false, filters });
  if (typeof picked !== 'string') return null;
  const text = await t.fs.readTextFile(picked);
  const name = picked.split(/[\\/]/).pop() ?? picked;
  return { name, text };
}
