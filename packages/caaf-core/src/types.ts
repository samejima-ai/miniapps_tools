/**
 * CaaF Core — Data Model (FW spec §4)
 *
 * 汎用・固有禁止。ここに特定の利用者・業務の固有名詞や分岐を書かない（設計原則 1: Core純度）。
 * ドメインは利用者が CaaFApp として外部注入する。
 *
 * すべての型は宣言的データのみ。LLM SDK・DB クライアント・I/O への依存を持たない。
 */

/** AI 抽出の信頼度（0.0–1.0）。FW spec §4.3 / §7.3 */
export type Confidence = number;

/**
 * 信号色（FW spec §7.3）。Core は 3 色のみを定義する。
 * 利用者ドメインは Config 側で追加の overlay 色を持ってよいが、Core は green/yellow/red に閉じる。
 */
export type Signal = "green" | "yellow" | "red";

/** フィールド値の出所（FW spec §4.3）。confidence と合わせて確定度を表す。 */
export type FieldSource = "ai" | "user" | "default" | "context";

/** CaaFRecord のステータス遷移（FW spec §4.3）: draft → mapped → confirmed → executed（任意点で reset → draft） */
export type RecordStatus = "draft" | "mapped" | "confirmed" | "executed" | "error";

/** フィールド型（FW spec §4.2） */
export type CaaFFieldType =
  | "string"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "enum"
  | "reference"
  | "array";

/** 入力フィールド定義（FW spec §4.2） */
export interface CaaFField {
  name: string;
  type: CaaFFieldType;
  required: boolean;
  label: string;
  /** AI マッピング用ヒント（プロンプトに展開される） */
  description?: string;
  /** enum 選択肢（type="enum" 時） */
  options?: string[];
  default?: unknown;
  /** 外部マスタ参照（type="reference" 時、Adapter id を指す） */
  referenceAdapter?: string;
}

/** Adapter 接続設定（FW spec §4.1）。type は既知種別 + 任意拡張文字列。 */
export interface CaaFAdapterConfig {
  type: "db" | "mcp" | "sheets" | "api" | (string & {});
  config: Record<string, unknown>;
}

/** L0.5 Router 用ヒント（自己申告。FW spec §4.1 / §5） */
export interface CaaFRouting {
  keywords?: string[];
  /** 意図判定に LLM が使う説明（必須） */
  description: string;
  priority?: number;
}

/** LLM に注入する文脈（このチャットが何を入力する場か。FW spec §4.1） */
export interface CaaFContext {
  role: string;
  description: string;
  examples?: string[];
}

/**
 * CaaFApp（FW spec §4.1）— 最上位単位。
 * 1 アプリ = スキーマ + コンテキスト + 制約 + 接続 + ルーティングヒント。
 * App 切替 = 文脈の切替。
 */
export interface CaaFApp {
  id: string;
  name: string;
  icon?: string;
  context: CaaFContext;
  schema: CaaFField[];
  /** App 固有の禁止事項（ソフト制約・LLM 注入。FW spec §10.2） */
  dont: string[];
  adapter: CaaFAdapterConfig;
  routing: CaaFRouting;
}

/** ランタイムのフィールド値（FW spec §4.3） */
export interface CaaFFieldValue {
  value: unknown;
  confidence: Confidence;
  source: FieldSource;
}

/** CaaFRecord（ランタイム。FW spec §4.3） */
export interface CaaFRecord {
  app: string;
  fields: Record<string, CaaFFieldValue>;
  status: RecordStatus;
}
