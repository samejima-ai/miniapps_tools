/**
 * L0-4 状態遷移 — XState v5
 *
 * 工具管理ミニアプリ MVP の主要ステートマシン2本:
 *   1. AppMachine: アプリ全体の画面遷移（Gate → 2タブ → モード）
 *   2. CaaFCardMachine: CaaF入力時の確認カードのライフサイクル
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
          },
        },
        list: {
          initial: "viewing",
          states: {
            viewing: {
              on: {
                ENTER_RETURN_MODE: "returning",
                GO_INPUT: "#app.authenticated.input",
              },
            },
            returning: {
              on: {
                EXIT_RETURN_MODE: "viewing",
              },
            },
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
