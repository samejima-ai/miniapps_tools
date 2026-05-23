import type { Config } from "tailwindcss";

/**
 * Tailwind 設定は DESIGN.md の YAML フロントマターを SSOT とする。
 * 本ファイルは DESIGN.md のトークンを Tailwind 互換形式に変換した派生物。
 * DESIGN.md の更新時は本ファイルも同 PR 内で更新する（盆栽運用）。
 *
 * 検査: scripts/check-design-tokens.mjs で DESIGN.md ↔ tailwind.config.ts の整合を機械検査。
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Kakuman Brand (DESIGN.md colors)
        primary: {
          DEFAULT: "#0066b3",
          dark: "#004e8a",
          light: "#e8f2fb",
        },
        accent: "#d4af37",
        ink: "#1a1d23",
        "text-secondary": "#5a6270",
        surface: "#ffffff",
        background: "#f0f3f7",
        divider: "#d4d9e0",
        "background-subtle": "#f4f6f9",
        success: "#2e8b57",
        warning: "#d4892f",
        "warning-strong": "#e67e22",
        error: "#c0392b",
        // Signal Colors (DESIGN.md - 信号UI 専用)
        "signal-green": "#2e8b57",
        "signal-yellow": "#d4892f",
        "signal-orange": "#e67e22",
        "signal-red": "#c0392b",
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-jp)", "'Noto Sans JP'", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        // DESIGN.md typography トークン（[size, { lineHeight, fontWeight }]）
        "headline-lg": ["18px", { lineHeight: "1.3", fontWeight: "900" }],
        "headline-md": ["15px", { lineHeight: "1.3", fontWeight: "700" }],
        "body-md": ["13.5px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-xs": ["10.5px", { lineHeight: "1.2", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "7px",
        md: "10px",
        lg: "13px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,.07)",
        "card-strong": "0 4px 16px rgba(0,0,0,.07)",
        cta: "0 6px 20px rgba(46,139,87,.35)",
        "primary-cta": "0 2px 8px rgba(0,102,179,.2)",
      },
      spacing: {
        // DESIGN.md spacing トークン（4px グリッド）
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "0.5": "2px",
        "4.5": "18px",
      },
      maxWidth: {
        // DESIGN.md Layout: モバイル 430px 想定
        mobile: "430px",
      },
    },
  },
  plugins: [],
};

export default config;
