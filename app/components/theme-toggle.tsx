"use client";

const THEME_STORAGE_KEY = "bkk-air-theme";

export default function ThemeToggle() {
  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch { /* Theme remains usable when storage is blocked. */ }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="สลับโหมดสว่างและโหมดมืด"
      title="สลับโหมดสี"
    >
      <span className="theme-toggle-moon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" /></svg></span>
      <span className="theme-toggle-sun" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></svg></span>
    </button>
  );
}
