import '@testing-library/jest-dom/vitest';

// jsdom lacks object-URL APIs used by the browser download fallback. Provide
// no-op stubs so export flows can be exercised in tests without touching disk.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => undefined;
}
// Anchor-triggered downloads would attempt navigation in jsdom; make click a
// no-op so the download path runs cleanly.
HTMLAnchorElement.prototype.click = () => undefined;
