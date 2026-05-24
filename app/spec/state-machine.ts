/**
 * L0-4 状態遷移 — XState v5
 *
 * 工具管理ミニアプリ の主要ステートマシン3本:
 *   1. AppMachine: アプリ全体の画面遷移（Gate → 3タブ → モード）
 *   2. CaaFCardMachine: CaaF入力時の確認カードのライフサイクル
 *   3. UnitMachine: 個体の状態 (in/out/lost) と movement イベントによる遷移（M0 追加, ADR-004）
 *
 * Mermaid 図は state-diagrams.md を参照。
 */

import { assign, setup } from "xstate";
import type { CaaFExtractionResult, Signal } from "./domain";

// ============================================================================
// 1. AppMachine — アプリ全体
// ============================================================================

type AppContext = {
  currentUserId: string | null;
};

type AppEvent =
  | { type: "EMPLOYEE_SELECTED"; userId: string }
  | { type: "GO_INPUT" }
  | { type: "GO_LIST" }
  | { type: "GO_LOST" }
  | { type: "GO_MASTER" }
  | { type: "ENTER_RETURN_MODE" }
  | { type: "EXIT_RETURN_MODE" }
  | { type: "SWITCH_USER" };

export const appMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as AppEvent,
  },
  actions: {
    setUser: assign({
      currentUserId: ({ event }) => (event.type === "EMPLOYEE_SELECTED" ? event.userId : null),
    }),
    clearUser: assign({ currentUserId: () => null }),
  },
  guards: {
    hasUser: ({ context }) => context.currentUserId !== null,
  },
}).createMachine({
  id: "app",
  context: { currentUserId: null },
  initial: "gate",
  states: {
    gate: {
      on: {
        EMPLOYEE_SELECTED: {
          target: "authenticated",
          actions: "setUser",
        },
      },
    },
    authenticated: {
      initial: "list",
      states: {
        input: {
          on: {
            GO_LIST: "list",
            GO_LOST: "lost",
            GO_MASTER: "master",
          },
        },
        list: {
          initial: "viewing",
          states: {
            viewing: {
              on: {
                ENTER_RETURN_MODE: "returning",
                GO_INPUT: "#app.authenticated.input",
                GO_LOST: "#app.authenticated.lost",
                GO_MASTER: "#app.authenticated.master",
              },
            },
            returning: {
              on: {
                EXIT_RETURN_MODE: "viewing",
              },
            },
          },
        },
        lost: {
          on: {
            GO_LIST: "list",
            GO_INPUT: "input",
            GO_MASTER: "master",
          },
        },
        master: {
          on: {
            GO_LIST: "list",
            GO_INPUT: "input",
            GO_LOST: "lost",
          },
        },
      },
      on: {
        SWITCH_USER: {
          target: "gate",
          actions: "clearUser",
        },
      },
    },
  },
});

// ============================================================================
// 2. CaaFCardMachine — CaaF入力時の確認カードライフサイクル
// ============================================================================

type CardContext = {
  rawInput: string;
  extraction: CaaFExtractionResult | null;
  signal: Signal | null;
  error: string | null;
};

type CardEvent =
  | { type: "SUBMIT_TEXT"; rawInput: string }
  | { type: "EXTRACTION_SUCCESS"; extraction: CaaFExtractionResult; signal: Signal }
  | { type: "EXTRACTION_ERROR"; error: string }
  | { type: "CONFIRM" }
  | { type: "REDIRECT_TO_RETURN_MODE" }
  | { type: "EDIT" }
  | { type: "RESET" };

export const caafCardMachine = setup({
  types: {
    context: {} as CardContext,
    events: {} as CardEvent,
  },
  actions: {
    storeInput: assign({
      rawInput: ({ event }) => (event.type === "SUBMIT_TEXT" ? event.rawInput : ""),
      extraction: () => null,
      signal: () => null,
      error: () => null,
    }),
    storeExtraction: assign({
      extraction: ({ event }) => (event.type === "EXTRACTION_SUCCESS" ? event.extraction : null),
      signal: ({ event }) => (event.type === "EXTRACTION_SUCCESS" ? event.signal : null),
    }),
    storeError: assign({
      error: ({ event }) => (event.type === "EXTRACTION_ERROR" ? event.error : null),
    }),
    reset: assign({
      rawInput: () => "",
      extraction: () => null,
      signal: () => null,
      error: () => null,
    }),
  },
  guards: {
    /**
     * 確定可能か（D-4: 自動INSERTしない、人がタップして確定する分の最低条件）
     * - signal が red でない（red は items 空 = 登録不可）
     * - extraction が存在し、items が空でない
     * - action が return でない（return は一覧モードへ誘導 D-5）
     */
    canConfirm: ({ context }) =>
      context.extraction !== null &&
      context.extraction.items.length > 0 &&
      context.signal !== "red" &&
      context.extraction.action !== "return",
    isReturnAction: ({ context }) => context.extraction?.action === "return",
  },
}).createMachine({
  id: "caafCard",
  context: { rawInput: "", extraction: null, signal: null, error: null },
  initial: "idle",
  states: {
    idle: {
      on: {
        SUBMIT_TEXT: {
          target: "extracting",
          actions: "storeInput",
        },
      },
    },
    extracting: {
      on: {
        EXTRACTION_SUCCESS: [
          {
            target: "redirecting",
            guard: ({ event }) =>
              event.type === "EXTRACTION_SUCCESS" && event.extraction.action === "return",
            actions: "storeExtraction",
          },
          {
            target: "reviewing",
            actions: "storeExtraction",
          },
        ],
        EXTRACTION_ERROR: {
          target: "error",
          actions: "storeError",
        },
      },
    },
    reviewing: {
      on: {
        CONFIRM: {
          target: "confirmed",
          guard: "canConfirm",
        },
        EDIT: "idle",
        RESET: { target: "idle", actions: "reset" },
      },
    },
    redirecting: {
      // action=return の場合: UI 側で一覧返却モードへ遷移するイベントを発火
      on: {
        REDIRECT_TO_RETURN_MODE: { target: "idle", actions: "reset" },
      },
    },
    error: {
      on: {
        SUBMIT_TEXT: {
          target: "extracting",
          actions: "storeInput",
        },
        RESET: { target: "idle", actions: "reset" },
      },
    },
    confirmed: {
      // INSERT 成功後の最終状態。UI 側で一覧タブへ遷移、本マシンはリセット。
      on: {
        RESET: { target: "idle", actions: "reset" },
      },
    },
  },
});

// ============================================================================
// 3. UnitMachine — 個体の状態 (in/out/lost) ライフサイクル（M0 追加, ADR-004）
//
// movement_type の最新行から導出される current_status の概念モデル。
// 実体は罠A 維持で view (v_unit_current_status) が一意の真実源。
// 本マシンは UI 表示・遷移可能性の検証用。
// ============================================================================

type UnitContext = {
  unitId: string | null;
  itemId: string | null;
  lastHolderId: string | null;
};

type UnitEvent =
  | { type: "CHECKOUT"; holderId: string }
  | { type: "RETURN" }
  | { type: "TRANSFER"; toLocationId: string }
  | { type: "REPORT_LOST" }
  | { type: "REPORT_FOUND" }
  | { type: "DEACTIVATE" }; // is_active=false（廃棄、別概念）

export const unitMachine = setup({
  types: {
    context: {} as UnitContext,
    events: {} as UnitEvent,
  },
  actions: {
    setHolder: assign({
      lastHolderId: ({ event }) => (event.type === "CHECKOUT" ? event.holderId : null),
    }),
    clearHolder: assign({ lastHolderId: () => null }),
  },
}).createMachine({
  id: "unit",
  context: { unitId: null, itemId: null, lastHolderId: null },
  initial: "in",
  states: {
    /**
     * in: 倉庫在庫（デフォルト所在 = 事務所・倉庫、ADR-006）
     * - movement_type の最新が return/found/null → ここ
     */
    in: {
      on: {
        CHECKOUT: { target: "out", actions: "setHolder" },
        REPORT_LOST: "lost",
        DEACTIVATE: "deactivated",
      },
    },
    /**
     * out: 現場に持出中
     * - movement_type の最新が checkout/transfer → ここ
     * - 二重持出禁止（D-11）: out から CHECKOUT は受理しない
     */
    out: {
      on: {
        RETURN: { target: "in", actions: "clearHolder" },
        TRANSFER: "out", // 現場間移動も out 継続
        REPORT_LOST: { target: "lost", actions: "clearHolder" },
        // CHECKOUT は受理しない（既に持出中、D-11）
      },
    },
    /**
     * lost: 紛失中（M0 追加、ADR-004）
     * - movement_type の最新が lost → ここ
     * - 発見で in 復帰可能。物理ラベル復活前提
     */
    lost: {
      on: {
        REPORT_FOUND: "in",
        DEACTIVATE: "deactivated", // 紛失確定で廃棄するパス
        // CHECKOUT / RETURN は受理しない（先に発見必須）
      },
    },
    /**
     * deactivated: 論理削除済（is_active=false）
     * - マスタから消える。紛失リストにも出ない
     * - 復帰不可（物理削除と等価の終端）
     */
    deactivated: {
      type: "final",
    },
  },
});
