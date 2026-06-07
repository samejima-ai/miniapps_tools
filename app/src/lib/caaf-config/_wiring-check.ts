/**
 * M-A wiring check（CaaF gen-2 移行）
 *
 * `@caaf/core` が app ワークスペースから解決できることを型・値の両面で確認するための
 * 最小プレースホルダ。実利用（tools CaaFApp 定義 / db Adapter / IntentClassifier 等）は
 * M-B 以降で本ディレクトリ（src/lib/caaf-config/）に追加する。
 *
 * 本ファイルは Config 側（固有名詞 OK）に属する。Core純度の grep 検証対象外。
 */

import { type CaaFApp, confidenceSignal } from "@caaf/core";

/** 型解決の確認: CaaFApp 型が app からインポートできる。 */
export type CaaFAppRef = CaaFApp;

/** 値解決の確認: Core の純関数が app からインポート・実行できる。 */
export const CAAF_CORE_WIRED: boolean = confidenceSignal(1) === "green";
