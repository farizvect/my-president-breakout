export function resolveTheme(storedTheme, prefersLight) {
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  return prefersLight ? 'light' : 'dark';
}

export function nextTheme(currentTheme) {
  return currentTheme === 'light' ? 'dark' : 'light';
}
