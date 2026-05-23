"use client";

/**
 * Input Page — F2 CaaF入力（自然文→構造化→確定登録）
 *
 * LINE と同じノリの自然文入力。LLM で構造化 → 信号色 UI で確認 → 確定。
 * XState caafCardMachine で状態遷移を管理。
 *
 * Phase 0 = 全件確認。自動 INSERT しない (D-4)。
 * LLM は抽出器、欠損補完しない (D-5)。
 */

import { useState } from "react";

export default function InputPage() {
  const [inputText, setInputText] = useState("");

  return (
    <div className="flex-1 flex flex-col">
      {/* 入力エリア */}
      <div className="px-lg pt-md flex-1 flex flex-col gap-md">
        <div className="text-headline-md text-ink">持出入力</div>
        <div className="text-body-sm text-text-secondary">LINE と同じノリで入力してください</div>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="例: マキタバッテリー 7,8番 池下現場に持っていく"
          className="w-full bg-background-subtle border border-divider rounded-lg px-md py-md text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary resize-none min-h-[100px]"
          rows={4}
        />

        {/* 送信ボタン */}
        <button
          type="button"
          disabled={!inputText.trim()}
          className="bg-primary text-surface font-bold rounded-md py-md min-h-[44px] shadow-primary-cta disabled:opacity-40 disabled:shadow-none transition-all"
        >
          送信
        </button>

        {/* 確認カードエリア（F5 信号色UI） */}
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
          <div className="text-body-sm text-center">
            自然文を入力して送信すると、ここに確認カードが表示されます
          </div>
          <div className="text-label-xs mt-sm">LLM ルーター接続後に有効化</div>
        </div>
      </div>
    </div>
  );
}
