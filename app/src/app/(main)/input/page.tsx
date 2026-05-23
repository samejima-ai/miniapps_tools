"use client";

/**
 * Input Page — F2 CaaF入力（自然文→構造化→確定登録）
 *
 * LINE と同じノリの自然文入力。LLM で構造化 → 信号色 UI で確認 → 確定。
 * 入力 → 抽出 → レビュー → 確定 の状態遷移。
 *
 * Phase 0 = 全件確認。自動 INSERT しない (D-4)。
 * LLM は抽出器、欠損補完しない (D-5)。
 *
 * UX Must 閾値: 持出登録 3タップ以内（入力→確認→確定）
 */

import { SignalCard } from "@/components/signal-card";
import { extractFromNaturalText } from "@/lib/llm/router";
import { useUser } from "@/lib/user-context";
import type { CaaFExtractionResult, Signal } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type CardState = "idle" | "extracting" | "reviewing" | "confirmed" | "error";

export default function InputPage() {
  const { currentUser } = useUser();
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [cardState, setCardState] = useState<CardState>("idle");
  const [extraction, setExtraction] = useState<CaaFExtractionResult | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 送信: LLM 抽出
  const handleSubmit = useCallback(async () => {
    if (!inputText.trim()) return;

    setCardState("extracting");
    setError(null);

    try {
      const result = await extractFromNaturalText(inputText);
      setExtraction(result.extraction);
      setSignal(result.signal);

      // action=return の場合は返却モードへ誘導 (D-5)
      if (result.extraction.action === "return") {
        setCardState("reviewing");
      } else {
        setCardState("reviewing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "抽出に失敗しました");
      setCardState("error");
    }
  }, [inputText]);

  // 確定: movement INSERT
  const handleConfirm = useCallback(async () => {
    if (!extraction || !currentUser) return;

    setConfirming(true);
    try {
      // TODO: マスタ参照解決（item name → item_id, unit_number → unit_id）が
      // 実装されるまで DB 書き込みは行わない。デモモードでは UI 確認のみ。
      // マスタ解決の実装後にこのガードを外し、insertMovement を有効化する。

      setCardState("confirmed");

      // 確定後、1秒後に一覧へ遷移
      setTimeout(() => {
        setInputText("");
        setExtraction(null);
        setSignal(null);
        setCardState("idle");
        router.push("/list");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setCardState("error");
    } finally {
      setConfirming(false);
    }
  }, [extraction, currentUser, router]);

  // 修正: 入力画面に戻る
  const handleEdit = useCallback(() => {
    setCardState("idle");
    setExtraction(null);
    setSignal(null);
  }, []);

  // 返却モードへリダイレクト
  const handleRedirectToReturn = useCallback(() => {
    setInputText("");
    setExtraction(null);
    setSignal(null);
    setCardState("idle");
    router.push("/list");
  }, [router]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-lg pt-md flex-1 flex flex-col gap-md">
        <div className="text-headline-md text-ink">持出入力</div>
        <div className="text-body-sm text-text-secondary">LINE と同じノリで入力してください</div>

        {/* 入力テキストエリア */}
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="例: マキタバッテリー 7,8番 池下現場に持っていく"
          className="w-full bg-background-subtle border border-divider rounded-lg px-md py-md text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none min-h-[80px]"
          rows={3}
          disabled={cardState === "extracting" || cardState === "confirmed"}
        />

        {/* 送信ボタン */}
        {(cardState === "idle" || cardState === "error") && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!inputText.trim()}
            className="bg-primary text-surface font-bold rounded-md py-md min-h-[44px] shadow-primary-cta disabled:opacity-40 disabled:shadow-none transition-all"
          >
            送信
          </button>
        )}

        {/* 抽出中 */}
        {cardState === "extracting" && (
          <div className="flex items-center justify-center py-lg gap-sm text-primary">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-body-sm">解析中...</span>
          </div>
        )}

        {/* エラー */}
        {cardState === "error" && error && (
          <div className="bg-error/10 border border-error rounded-md p-md text-body-sm text-error">
            {error}
          </div>
        )}

        {/* F5: 信号色確認カード */}
        {cardState === "reviewing" && extraction && signal && (
          <SignalCard
            extraction={extraction}
            signal={signal}
            onConfirm={handleConfirm}
            onEdit={handleEdit}
            onRedirectToReturn={handleRedirectToReturn}
            confirming={confirming}
          />
        )}

        {/* 確定後 */}
        {cardState === "confirmed" && (
          <div className="flex flex-col items-center justify-center py-lg gap-sm text-success">
            <div className="text-[32px]">✅</div>
            <div className="text-body-md font-bold">登録完了</div>
            <div className="text-body-sm text-text-secondary">一覧画面に移動します...</div>
          </div>
        )}

        {/* 初期状態の案内 */}
        {cardState === "idle" && !inputText.trim() && (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary gap-sm">
            <div className="text-body-sm text-center">
              自然文を入力して送信すると、確認カードが表示されます
            </div>
            <div className="text-label-xs">デモモード（LLM ローカル解析）</div>
          </div>
        )}
      </div>
    </div>
  );
}
