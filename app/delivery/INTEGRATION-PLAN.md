# INTEGRATION-PLAN — Platform v3.0 受入計画

> FX-M P2 成果物。ハンドオフ文書 §7 準拠。

---

## 1. データ層境界判定

**判定: 独立型**

| 判定基準 | 結果 |
|---|---|
| Core → miniapps_tools への FK | **0 件** |
| miniapps_tools → Core への FK | **0 件**（現時点。将来 `holder_id` / `project_id` に FK 予定） |
| FK 方向 | miniapps_tools 内で完結 + Core を参照読みのみ |

**根拠**:
- `items`, `individual_units`, `locations`, `item_movements`, `item_name_aliases`, `project_name_aliases` は全て `miniapps_tools` スキーマ内
- `public.employees` / `public.projects` は SELECT のみ（Write なし）
- Core テーブルから miniapps_tools テーブルへの参照は存在しない

**DB 配置**: `miniapps.tools.*` に分離（独立型の標準配置）

**アクセス方法**: `supabase.schema('miniapps_tools').from('table')`（現行と同一）

---

## 2. Write 境界

| 対象 | 操作 | 根拠 |
|---|---|---|
| `public.employees` | **Read-Only** | Gate 画面の社員一覧表示、Server Action 内の名前引き |
| `public.projects` | **Read-Only** | CaaF 入力での現場名解決、一覧のグループ化 |
| `miniapps_tools.items` | Read + Write | 独自モノ（工具マスタ） |
| `miniapps_tools.individual_units` | Read + Write | 独自モノ（個体） |
| `miniapps_tools.locations` | Read + Write | 独自モノ（保管場所） |
| `miniapps_tools.item_movements` | Read + **INSERT only** | コト（append-only イベント） |
| `miniapps_tools.item_name_aliases` | Read + Write | 独自モノ（エイリアス学習） |
| `miniapps_tools.project_name_aliases` | Read + Write | 独自モノ（案件エイリアス学習） |

**違反なし**: ヒト・共有モノへの Write は存在しない。

---

## 3. 認証置換方針

### 現行（独立稼働版）
- `src/lib/user-context.tsx` に閉じ込め済
- sessionStorage ベースの社員選択（Gate 画面）
- `currentUser.employee_id` を全コンポーネントが `useUser()` hook 経由で取得

### 置換後（Platform 統合版）
```
auth.users → employees.profile_id = auth.uid()
                ↓
         employees.employee_id
                ↓
     useUser() hook が返す値は同じ型
```

### 置換手順
1. `user-context.tsx` の `selectUser()` を `auth.uid()` → `employees` lookup に差替
2. Gate 画面を削除（Platform middleware が認証済みを保証）
3. `DEV_BYPASS_AUTH` 等のバイパスフラグがあれば削除（現時点で未実装のため対応不要）
4. `switchUser()` を削除（Platform はユーザー切替を提供しない。共有端末運用は Platform 側の設計に従う）

**影響範囲**: `user-context.tsx` 1 ファイル + `page.tsx`（Gate）+ `(main)/layout.tsx`（guard）の 3 ファイルのみ。業務ロジックへの影響なし。

---

## 4. 領域 A-D 移植手順

### A. コード移植

**移植先**: `apps/platform/app/apps/tools/`

| 移植する | 移植しない |
|---|---|
| `src/app/(main)/input/` → `apps/tools/input/` | `src/app/page.tsx`（Gate 画面。Platform 不要） |
| `src/app/(main)/list/` → `apps/tools/list/` | `src/app/(auth)/`（認証。Platform 置換） |
| `src/app/(main)/master/` → `apps/tools/master/` | `next.config.ts`（Platform の設定に統合） |
| `src/components/` → `apps/tools/_components/` | `tailwind.config.ts`（Platform 統合） |
| `src/lib/llm/` → `apps/tools/_lib/llm/` | `package.json`（Platform の monorepo に統合） |
| `src/lib/supabase/` → `apps/tools/_lib/supabase/`* | `public/`（manifest 等は Platform 側管理） |
| `src/lib/user-context.tsx` → 削除（§3 置換） | テスト・CI 設定（Platform CI に統合） |
| `src/types/` → `apps/tools/_lib/types/` | |
| `spec/domain.ts` の Zod → `packages/supabase/src/schemas/mini-apps/tools/` | |

*Supabase クライアントは `@kakuman/supabase` に置換。固有ロジック（movements, projects query）のみ残す。

### B. 認証切替
→ §3 参照。3 ファイルの変更で完了。

### C. 共有パッケージ統合

| 現行 | 統合後 |
|---|---|
| `src/lib/supabase/client.ts` | `@kakuman/supabase/client` の `createSupabaseBrowserClient()` |
| `src/lib/supabase/server.ts` | `@kakuman/supabase/server` の `createSupabaseServerClient(cookies())` |
| 手書き DB 型 | `@kakuman/supabase/types` の `Database` |
| Zod スキーマ（`spec/domain.ts`） | `packages/supabase/src/schemas/mini-apps/tools/` |
| emoji アイコン（📋✏️🔧） | `@kakuman/ui/icons` の lucide コンポーネント |
| 独自 PendingOverlay（未実装） | `@kakuman/ui` の `PendingOverlay` |

### D. 接続点

**Activity Feed 投入イベント（速報候補 3 件）**:

| イベント | `action_text` 例 | `is_important` |
|---|---|---|
| 持出確定（checkout） | `{employee}が{item}を{site}に持出` | false |
| 一括返却（return batch） | `{employee}が{N}点を返却` | false |
| 長期未返却アラート（days_out >= 7） | `{item}が{N}日間未返却` | true |

**ホーム launcher タイル**:
- アイコン: Wrench（lucide）
- ラベル: 工具管理
- URL: `getAppUrl('tools')`

---

## 5. 卒業計画

### 方針: **統合完了後に独立デプロイを停止**

**理由**:
- 同一 Supabase を共有しており、2 系統並走のメリットがない
- 認証が Platform に統合された時点で独立版の Gate 画面は機能しなくなる
- 運用データの SSOT は 1 つであるべき

### 移行手順
1. Platform 統合版をステージングで検証
2. 現場ユーザーにリンク先変更をアナウンス
3. Vercel 独立プロジェクトを pause（即時削除はしない。1 ヶ月間は rollback 可能に）
4. 問題なければ独立プロジェクトを削除

---

## 6. 現状の §1-§6 違反一覧

| § | 項目 | 状態 | 対応計画 |
|---|---|---|---|
| §5-2 | Server Action 戻り値 `ActionResult<T>` | **未対応** | M2 で統一 |
| §5-3 | emoji をUIアイコンに使わない | **違反**（bottom-tabs 3 件） | M2 で lucide 置換 |
| §5-3 | `min-h-dvh` | **適合**（`h-[100dvh]` 使用中） | 対応不要 |
| §5-4 | URL は `getAppUrl()` で生成 | **未対応**（独立稼働のため不要） | 統合時に対応 |
| §6-D | 速報イベント選定 | **骨子あり**（§4 に 3 件記載） | M2 で確定 |

**致命的違反: なし。残り 40% の開発で吸収可能。**

---

## 受入時 commit hash

（受入セッション実施時に記録）

```
commit: TBD
date: TBD
branch: master
```
