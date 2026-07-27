import { resolveTheme, nextTheme } from './theme-core.mjs';

const STORAGE_KEY = 'presidential-speech-theme';
const root = document.documentElement;
const toggle = document.getElementById('theme-toggle');
const system = window.matchMedia('(prefers-color-scheme: light)');

function storedTheme() {
  try { return localStorage.getItem(STORAGE_KEY); }
  catch { return null; }
}

function applyTheme(theme, persist = false) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const themeColor = document.getElementById('theme-color');
  if (themeColor) themeColor.content = theme === 'light' ? '#f5f3ed' : '#050505';
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* storage may be blocked */ }
  }
  if (toggle) {
    const target = nextTheme(theme);
    toggle.textContent = target.toUpperCase();
    toggle.setAttribute('aria-label', `Switch to ${target} mode`);
    toggle.setAttribute('title', `Switch to ${target} mode`);
    toggle.setAttribute('aria-pressed', String(theme === 'light'));
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

applyTheme(resolveTheme(storedTheme(), system.matches));

toggle?.addEventListener('click', () => {
  applyTheme(nextTheme(root.dataset.theme), true);
});

system.addEventListener('change', (event) => {
  if (!storedTheme()) applyTheme(resolveTheme(null, event.matches));
});
