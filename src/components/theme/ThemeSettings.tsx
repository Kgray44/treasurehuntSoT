"use client";

import { useApplicationTheme } from "@/components/theme/ThemeProvider";
import type { ApplicationTheme } from "@/theme/theme";

const options: Array<{ id: ApplicationTheme; title: string; detail: string }> = [
  {
    id: "verdant-depths",
    title: "Verdant Depths",
    detail: "Deep green-black water, muted emerald atmosphere, warm brass, and cream parchment.",
  },
  {
    id: "moonlit-blue",
    title: "Moonlit Blue",
    detail: "Navy water, cool fog, moonlit cyan accents, and the same readable parchment materials.",
  },
];

export function ThemeSettings() {
  const { theme, scope, status, message, setTheme } = useApplicationTheme();
  return (
    <main className="theme-settings-page">
      <header>
        <p className="eyebrow">Application settings</p>
        <h1>Choose your waters</h1>
        <p>
          This preference colors the Library, Captain tools, Studio, settings, and experiences that use your application
          preference. A Tall Tale may intentionally override it.
        </p>
      </header>
      <fieldset>
        <legend>Application theme</legend>
        <div className="theme-option-grid">
          {options.map((option) => (
            <label className={`theme-option theme-${option.id}`} key={option.id}>
              <input
                type="radio"
                name="application-theme"
                value={option.id}
                checked={theme === option.id}
                disabled={status === "saving"}
                onChange={() => void setTheme(option.id)}
              />
              <span className="theme-swatch" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>{option.title}</strong>
              <small>{option.detail}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <p className={`theme-setting-status status-${status}`} role="status">
        {message} {scope === "anonymous" ? "Sign in through a role workspace to sync it to a profile." : ""}
      </p>
    </main>
  );
}
