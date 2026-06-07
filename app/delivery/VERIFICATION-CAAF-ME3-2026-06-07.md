# VERIFICATION.md — CaaF gen-2 M-E.3（現場 name→id 解決）

## 判定: PASS（runtime 実測は preview 申し送り）

独立検証（実装コンテキスト隔離）。対象: `tools-adapter.ts`(resolve-site) / `tools-mapping.ts`(SiteCandidate) / `host-turn.ts`(siteCandidates/applySiteResolution/chooseSite) / `host-server.ts`(resolveSiteRef) / `/input2/page.tsx` / index.ts。
体制: M2 / autonomous / LC=1。上位仕様: `spec/caaf-migration.md` §2/§4/§6、gen-1 `resolveProjectFromSite`。

---

## 1. スコープ適合

| 要件 | 充足 | 根拠 |
|---|---|---|
| 現場 name→project_id 解決（gen-1 パリティ） | PASS | resolveSite が alias 完全一致 → public.projects ILIKE（gen-1 resolveProjectFromSite と同型） |
| 解決結果を item_movements に記録 | PASS | 1 件確定で record.site=project_id 昇格 → recordToMovementInput（M-C）が projectId として書く |
| gen-1 据え置き | PASS | gen-1 ファイル・write 経路 無変更。変更は caaf-config + /input2 のみ |

## 2. 正当性（逐点）

| # | 観点 | 判定 | 根拠 |
|---|---|---|---|
| A | 0/1/N 分岐 | PASS | applySiteResolution: 1→setSite（昇格）、N→siteCandidates 保持（未昇格）、0→未昇格。テスト 4 件 |
| B | write 安全性 | PASS | 複数/0 件では record.site を設定しない＝誤 project_id を書かない。未解決名は pendingRefs（表示のみ） |
| C | 任意性 | PASS | site は optional。未確定でも isComplete/ready に非影響（テスト: 1 件解決後も phase=ready 維持） |
| D | chooseSite | PASS | 複数候補からの選択で record.site 確定・siteCandidates クリア（テスト） |
| E | best-effort 防御 | PASS | public クライアント未設定/projects エラーは catch して空（未照合）。抽出全体を落とさない（gen-1 同等） |
| F | server/pure 分離 | PASS | resolveSite は server-only（adapter）、applySiteResolution/chooseSite は純（host-turn、79 テスト jsdom） |
| G | capture 結線 | PASS | resolveSiteRef は item 解決後に site を read 解決（既に record.site あれば skip）。site は item と独立に解決可能 |
| H | Core 無変更 | PASS | pnpm purity:core 緑。packages/caaf-core 差分ゼロ |

## 3. 三軸

| 軸 | 判定 | 根拠 |
|---|---|---|
| 仕様適合 | PASS | migration §3 schema の site reference（referenceAdapter: tools-projects）を実解決。§4 read 系の拡張 |
| 動作 | PASS（静的） | tsc / vitest 79 / next build(/input2 6.15kB) / biome 緑。解決判断は純テストで担保 |
| ユーザビリティ | 申し送り | 体感は preview で要確認。現場確定/候補/未照合の 3 表示で状態が明示される |

## 4. Don't / 配置 / 履歴（LC=1）
- write は M-C 委譲・無変更。罠A/D-1/D-7/D-11/D-3 非接触。delivery 配下に配置。§8 順守。

## 5. 提起（非 FAIL）
1. **runtime 未実測** → preview で現場照合（✓/候補/未照合）を sanity check 推奨（human-review-needed）。
2. **holder name→id / alias 学習は未実装**（gen-1 にも holder 解決は無い）→ M-E.4 候補。
3. **M-F（gen-1 撤去）は人間のパリティ sign-off 必須**。本 PR では実施しない。

## 最終判定
**PASS** — 現場解決を gen-1 パリティで gen-2 に実装。逐点 A〜H・仕様/動作で PASS。write 安全（誤 project_id を書かない）。
gen-1 非干渉。提起は preview 実測と次段の申し送りで、land の阻却事由ではない。
