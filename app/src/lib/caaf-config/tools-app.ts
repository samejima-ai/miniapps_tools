/**
 * CaaF gen-2 Config — 工具 CaaFApp 定義（M-D、純データ + 純関数）
 *
 * Core（`@caaf/core`）に注入する「工具入力」アプリ定義。migration §3 の概形を実装する。
 * schema は M-C の `TOOLS_FIELDS` を再利用する（M-D は M-C 依存）。
 *
 * 固有名詞 OK = Config 側（Core純度の grep 対象外）。server-only 非依存（純データ/純関数）。
 *
 * --- tracking_type 条件付き必須 overlay ---
 * units / quantity は「個体管理なら units 必須・数量管理なら quantity 必須」という
 * tracking_type 依存の条件付き必須で、Core の単純 `required: boolean` では表せない。
 * そこで item 解決後に `toolsAppForTracking(tracking)` で **effective app** を作り、
 * host はその schema で Resolver ラリー（nextRequiredField / isComplete）を回す（§3 M-D 決定事項）。
 */

import type { CaaFApp, CaaFField } from "@caaf/core";
import { TOOLS_FIELD, TOOLS_FIELDS } from "./tools-fields";

/** item の tracking_type。individual=個体番号管理 / quantity=数量管理。 */
export type ToolsTracking = "individual" | "quantity";

/**
 * 工具入力アプリ（item 未解決時のベース定義）。
 * units / quantity は両方 optional（tracking 未確定のため）。item 解決後は
 * `toolsAppForTracking` の effective app に切り替える。
 */
export const toolsApp: CaaFApp = {
  id: "tools",
  name: "工具入力",
  context: {
    role: "工具持出・返却アシスタント",
    description: "現場職人の自然文から工具の持出・返却を1件ずつ構造化する場。",
    examples: ["バッテリー 2,3番 ブロワ 1番 池下現場", "ブロワ 1番 返却", "脚立 5台 持ち出し"],
  },
  schema: TOOLS_FIELDS,
  dont: [
    // D-5: LLM に欠損を補完させない。曖昧な全返却は展開せず返却モードへ誘導する
    "曖昧な全返却（電動工具全返却など）は展開しない。返却モードへ誘導する",
    // D-11: 持出中の個体番号への二重持出は確定不可
    "持出中の番号への二重持出は確定不可とする",
    // 文脈外の話題は入力に戻す（App 文脈の純度を保つ）
    "工具と無関係な話題は入力に戻す",
  ],
  adapter: { type: "db", config: { schema: "miniapps_tools" } },
  routing: {
    keywords: ["持ち出し", "持出", "返却", "工具", "現場", "番"],
    description: "工具の持出・返却を item_movements に記録する",
    priority: 1,
  },
};

/**
 * tracking_type 条件付き必須の overlay（純関数）。
 *
 * item 解決後、その tracking_type に応じて units / quantity の一方を required 化し、
 * もう一方を schema から除外する（混在防止 — 個体管理に数量、数量管理に番号が紛れ込まない）。
 * 除外したフィールドは Core の `sanitizeRecord`/`dropForeignFields` で record からも落ちる。
 *
 *  - individual: `units` を required 化、`quantity` を除外
 *  - quantity:   `quantity` を required 化、`units` を除外
 *
 * tracking 未確定（item 未解決）時はベースの `toolsApp`（両方 optional）を使う。
 * 他フィールド（action / item / site / holder）の required・default は不変。
 */
export function toolsAppForTracking(tracking: ToolsTracking): CaaFApp {
  const drop = tracking === "individual" ? TOOLS_FIELD.quantity : TOOLS_FIELD.units;
  const require = tracking === "individual" ? TOOLS_FIELD.units : TOOLS_FIELD.quantity;

  const schema: CaaFField[] = TOOLS_FIELDS.filter((f) => f.name !== drop).map((f) =>
    f.name === require ? { ...f, required: true } : f,
  );

  return { ...toolsApp, schema };
}
