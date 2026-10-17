import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Light, dark, or follow the device. The choice is remembered in this browser. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("rl-theme") as Theme) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    apply(theme);
    try {
      if (theme === "system") localStorage.removeItem("rl-theme");
      else localStorage.setItem("rl-theme", theme);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
  const isDark = () => document.documentElement.classList.contains("dark");
  return { theme, setTheme, isDark };
}
