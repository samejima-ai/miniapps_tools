/**
 * M-A wiring check（CaaF gen-2 移行）
 *
 * `@caaf/core` が app ワークスペースから **静的に解決できる**ことを確認するための最小プレースホルダ。
 * 検証範囲は型解決と import 解決のみ（`tsc --noEmit` と `next build` の型チェックパスが対象）。
 *
 * 注意: 本ファイルはどこからも import されないため、Next/webpack のランタイム bundling 経路
 * （`transpilePackages` / `extensionAlias`）は M-A では実行されない。それらは M-B で実コード
 * （IntentClassifier / Extractor / db Adapter 等）が `@caaf/core` を import し、bundle に含まれた
 * 時点で初めて検証される。
 *
 * 実利用は M-B 以降で本ディレクトリ（src/lib/caaf-config/）に追加する。
 * 本ファイルは Config 側（固有名詞 OK）に属する。Core純度の grep 検証対象外。
 */

import { type CaaFApp, confidenceSignal } from "@caaf/core";

/** 型解決の確認: CaaFApp 型が app から型インポートできる（tsc が解決）。 */
export type CaaFAppRef = CaaFApp;

/**
 * 値インポートの解決確認: Core の純関数を app から import できる（tsc / build の型パスが解決）。
 * 本式はどこからも参照されないため bundle・実行はされない（静的な解決レベルの確認に留まる）。
 */
export const CAAF_CORE_WIRED: boolean = confidenceSignal(1) === "green";
