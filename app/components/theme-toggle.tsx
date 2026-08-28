"use client";

const THEME_STORAGE_KEY = "bkk-air-theme";

export default function ThemeToggle() {
  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="สลับโหมดสว่างและโหมดมืด"
      title="สลับโหมดสี"
    >
      <span className="theme-toggle-moon" aria-hidden="true">☾</span>
      <span className="theme-toggle-sun" aria-hidden="true">☀</span>
    </button>
  );
}
