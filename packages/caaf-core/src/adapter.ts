/**
 * CaaF Core — Adapter Interface (FW spec §8, L3)
 *
 * 書き込み先を抽象化する。全 Adapter が 3 メソッドを実装する。
 * Core はこのインターフェースだけに依存する（設計原則 7: Adapter 抽象）。
 *
 * 具体実装（db / mcp / sheets / api …）は利用者が Config 側で提供する。
 * Core にプロバイダ固有コードを置かない（Core純度）。
 */

import type { CaaFApp, CaaFField, CaaFRecord } from "./types.js";

/** write() の結果 */
export interface CaaFWriteResult {
  success: boolean;
  id?: string | number;
  /** 失敗時の説明（success=false 時） */
  error?: string;
}

export interface CaaFAdapter {
  id: string;

  /**
   * 接続先のスキーマを CaaFField[] 形式で取得する。
   * （DB 列 / Sheets ヘッダ / MCP ツール定義 / OpenAPI 等を CaaFField に射影）
   */
  getSchema(target: string): Promise<CaaFField[]>;

  /** 構造化データを書き込む（FW Don't: 必須未充足では呼ばれない、Guards が保証） */
  write(app: CaaFApp, record: CaaFRecord): Promise<CaaFWriteResult>;

  /**
   * 既存データ読み取り（補完・参照用）。
   * 「前回と同じ値」「マスタから選択」等のコンテキスト補完を可能にする（FW spec §8）。
   */
  read(app: CaaFApp, query?: Record<string, unknown>): Promise<unknown[]>;
}
