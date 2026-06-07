/**
 * CaaF gen-2 Config — 工具ドメインのフィールド契約（M-C）
 *
 * tools db Adapter が DB 列へ写像するための入力フィールド定義。
 * M-D の tools CaaFApp.schema はこれを再利用する（M-D は M-C 依存）。
 *
 * 純データ（固有名詞 OK = Config 側）。Core純度の grep 対象外。
 */

import type { CaaFField } from "@caaf/core";

/** フィールド名定数（adapter / app / mapping で共有し、文字列ずれを防ぐ）。 */
export const TOOLS_FIELD = {
  action: "action",
  item: "item",
  units: "units",
  quantity: "quantity",
  site: "site",
  holder: "holder",
} as const;

/**
 * 工具入力スキーマ（CaaFField[]）。
 * 注: units / quantity の「条件付き必須」（tracking_type 依存）は Core の単純 required では
 * 表せないため、M-D の Validate overlay で扱う。ここでは両方 optional に置く。
 */
export const TOOLS_FIELDS: CaaFField[] = [
  {
    name: TOOLS_FIELD.action,
    type: "enum",
    required: true,
    label: "操作",
    options: ["checkout", "return"],
    default: "checkout",
    description: "持ち出し=checkout / 返却=return。明示なければ checkout。",
  },
  {
    name: TOOLS_FIELD.item,
    type: "reference",
    required: true,
    label: "工具",
    referenceAdapter: "tools-items",
    description: "工具名。マスタ照合で item_id に解決する。",
  },
  {
    name: TOOLS_FIELD.units,
    type: "array",
    required: false,
    label: "番号",
    description: "個体番号の配列（個体管理の工具のみ）。",
  },
  {
    name: TOOLS_FIELD.quantity,
    type: "number",
    required: false,
    label: "数量",
    description: "数量管理の工具のみ。",
  },
  {
    name: TOOLS_FIELD.site,
    type: "reference",
    required: false,
    label: "現場",
    referenceAdapter: "tools-projects",
    description: "現場名。projects 照合で project_id に解決する。",
  },
  {
    name: TOOLS_FIELD.holder,
    type: "reference",
    required: false,
    label: "保持者",
    referenceAdapter: "tools-employees",
    description: "実際の保持者（代理入力時）。未指定なら入力者本人。",
  },
];
