"use client";

/**
 * Master Page — F6 マスタ管理（items / individual_units / locations）
 *
 * インライン展開で CRUD：
 * - 作成: 上部「+ 追加」フォーム
 * - 読込: 一覧
 * - 更新: 各カードをタップで展開、全フィールド編集
 * - 削除: 論理削除のみ（is_active=false）。物理削除禁止
 *
 * 罠A遵守: items/individual_units に status カラムは存在しない。
 * 状態は View 経由で導出する。
 */

import { useCallback, useEffect, useState } from "react";

type MasterTab = "items" | "units" | "locations";

// ============================================================================
// デモデータ（Supabase 未接続時）
// ============================================================================

type Item = {
  id: string;
  name: string;
  category: "tool" | "material" | "consumable";
  trackingType: "individual" | "quantity";
  itemCode: string | null;
  notes: string | null;
  isActive: boolean;
};

type Unit = {
  id: string;
  itemId: string;
  itemName: string;
  unitNumber: number;
  isActive: boolean;
  notes: string | null;
};

type Location = {
  id: string;
  name: string;
  kind: "warehouse" | "site";
  projectId: string | null;
  isActive: boolean;
};

const DEMO_ITEMS: Item[] = [
  {
    id: "demo-item-1",
    name: "マキタ18Vバッテリー",
    category: "tool",
    trackingType: "individual",
    itemCode: "MKT-BAT-18V",
    notes: null,
    isActive: true,
  },
  {
    id: "demo-item-2",
    name: "インパクトドライバー",
    category: "tool",
    trackingType: "individual",
    itemCode: "MKT-IMP-01",
    notes: null,
    isActive: true,
  },
];

const DEMO_UNITS: Unit[] = [
  {
    id: "demo-unit-1",
    itemId: "demo-item-1",
    itemName: "マキタ18Vバッテリー",
    unitNumber: 7,
    isActive: true,
    notes: null,
  },
];

const DEMO_LOCATIONS: Location[] = [
  { id: "demo-loc-1", name: "事務所・倉庫", kind: "warehouse", projectId: null, isActive: true },
  { id: "demo-loc-2", name: "裏倉庫", kind: "warehouse", projectId: null, isActive: true },
];

// ============================================================================
// 共通ラベル
// ============================================================================

const categoryLabel = (c: string) => {
  switch (c) {
    case "tool":
      return "工具";
    case "material":
      return "資材";
    case "consumable":
      return "消耗品";
    default:
      return c;
  }
};

const trackingLabel = (t: string) => (t === "individual" ? "個体管理" : "数量管理");

const isSupabaseEnabled = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================================
// Tab Selector
// ============================================================================

const TABS: Array<{ key: MasterTab; label: string }> = [
  { key: "items", label: "工具" },
  { key: "units", label: "個体" },
  { key: "locations", label: "場所" },
];

export default function MasterPage() {
  const [tab, setTab] = useState<MasterTab>("items");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-lg pt-md pb-sm">
        <div className="text-headline-md text-ink mb-sm">マスタ管理</div>

        {/* タブセグメント */}
        <div className="flex border border-divider rounded-md overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 px-md py-xs text-body-sm min-h-[36px] transition-colors ${
                tab === t.key
                  ? "bg-primary text-surface font-bold"
                  : "bg-surface text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "items" && <ItemsTab />}
      {tab === "units" && <UnitsTab />}
      {tab === "locations" && <LocationsTab />}
    </div>
  );
}

// ============================================================================
// Items Tab — インライン CRUD
// ============================================================================

type ItemFormValues = {
  name: string;
  category: "tool" | "material" | "consumable";
  trackingType: "individual" | "quantity";
  itemCode: string;
  notes: string;
};

const emptyItemForm: ItemFormValues = {
  name: "",
  category: "tool",
  trackingType: "individual",
  itemCode: "",
  notes: "",
};

function ItemsTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseEnabled()) {
        const { createClient } = await import("@/lib/supabase/client");
        const { listItems } = await import("@/lib/supabase/master");
        const supabase = createClient();
        const data = await listItems(supabase);
        setItems(data);
      } else {
        setItems(DEMO_ITEMS);
      }
    } catch (err) {
      console.error("listItems failed:", err);
      setItems(DEMO_ITEMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── 作成 ──
  const handleCreate = useCallback(
    async (values: ItemFormValues) => {
      if (!values.name.trim()) return;
      setError(null);
      try {
        if (isSupabaseEnabled()) {
          const { createClient } = await import("@/lib/supabase/client");
          const { insertItem } = await import("@/lib/supabase/master");
          const supabase = createClient();
          await insertItem(supabase, {
            name: values.name.trim(),
            category: values.category,
            trackingType: values.trackingType,
            itemCode: values.itemCode.trim() || null,
            notes: values.notes.trim() || null,
          });
          await reload();
        } else {
          setItems((prev) => [
            {
              id: `demo-new-${Date.now()}`,
              name: values.name.trim(),
              category: values.category,
              trackingType: values.trackingType,
              itemCode: values.itemCode.trim() || null,
              notes: values.notes.trim() || null,
              isActive: true,
            },
            ...prev,
          ]);
        }
        setShowCreate(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [reload],
  );

  // ── 更新 ──
  const handleUpdate = useCallback(
    async (id: string, values: ItemFormValues) => {
      if (!values.name.trim()) return;
      setError(null);
      try {
        if (isSupabaseEnabled()) {
          const { createClient } = await import("@/lib/supabase/client");
          const { updateItem } = await import("@/lib/supabase/master");
          const supabase = createClient();
          await updateItem(supabase, id, {
            name: values.name.trim(),
            category: values.category,
            trackingType: values.trackingType,
            itemCode: values.itemCode.trim() || null,
            notes: values.notes.trim() || null,
          });
          await reload();
        } else {
          setItems((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    name: values.name.trim(),
                    category: values.category,
                    trackingType: values.trackingType,
                    itemCode: values.itemCode.trim() || null,
                    notes: values.notes.trim() || null,
                  }
                : i,
            ),
          );
        }
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [reload],
  );

  // ── 論理削除 ──
  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`「${name}」を削除しますか？\n(論理削除: 履歴は保持されます)`)) return;
      setError(null);
      try {
        if (isSupabaseEnabled()) {
          const { createClient } = await import("@/lib/supabase/client");
          const { deactivateItem } = await import("@/lib/supabase/master");
          const supabase = createClient();
          await deactivateItem(supabase, id);
          await reload();
        } else {
          setItems((prev) => prev.filter((i) => i.id !== id));
        }
        if (editingId === id) setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [reload, editingId],
  );

  // ── AI notes 生成 ──
  const handleGenerateNotes = useCallback(async (itemId: string) => {
    setError(null);
    setGenLoading((prev) => new Set(prev).add(itemId));
    try {
      const { generateNotesForItem } = await import("./notes-actions");
      const result = await generateNotesForItem(itemId);
      if (result.ok) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, notes: result.notes } : it)),
        );
      } else {
        setError(`${itemId.slice(0, 8)}: ${result.error}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenLoading((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-lg pb-lg">
      {/* 新規追加ボタン */}
      {!showCreate && (
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setEditingId(null);
          }}
          className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta mb-md transition-all"
        >
          + 工具を追加
        </button>
      )}

      {/* 追加フォーム */}
      {showCreate && (
        <div className="border border-primary rounded-lg p-md mb-md bg-primary-light/30">
          <div className="text-label-xs text-primary font-bold mb-sm">新規工具</div>
          <ItemForm
            initial={emptyItemForm}
            isNew
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="text-label-xs text-error bg-error/10 border border-error rounded-md px-md py-sm mb-md">
          {error}
        </div>
      )}

      {/* 一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-xl text-text-secondary text-body-sm">
          読み込み中...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-xl gap-md text-text-secondary">
          <div className="text-[32px]">🔧</div>
          <div className="text-body-md">工具が登録されていません</div>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const generating = genLoading.has(item.id);

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  className="border border-primary rounded-lg p-md bg-primary-light/20"
                >
                  <div className="text-label-xs text-primary font-bold mb-sm">編集中</div>
                  <ItemForm
                    initial={{
                      name: item.name,
                      category: item.category,
                      trackingType: item.trackingType,
                      itemCode: item.itemCode ?? "",
                      notes: item.notes ?? "",
                    }}
                    onSubmit={(v) => handleUpdate(item.id, v)}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => handleDelete(item.id, item.name)}
                    onGenerateNotes={() => handleGenerateNotes(item.id)}
                    generating={generating}
                  />
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setEditingId(item.id);
                  setShowCreate(false);
                }}
                className="bg-surface border border-divider rounded-lg px-lg py-md shadow-card flex flex-col gap-xs text-left hover:border-primary transition-colors min-h-[56px]"
              >
                <div className="flex items-start gap-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm flex-wrap">
                      <span className="text-body-md font-bold text-ink truncate">{item.name}</span>
                      {item.itemCode && (
                        <span className="text-label-xs font-mono text-text-secondary">
                          {item.itemCode}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-sm mt-xs">
                      <span className="text-label-xs text-text-secondary">
                        {categoryLabel(item.category)}
                      </span>
                      <span className="text-label-xs text-text-secondary">
                        {trackingLabel(item.trackingType)}
                      </span>
                    </div>
                  </div>
                  <span className="text-label-xs text-primary shrink-0">編集</span>
                </div>
                {item.notes && (
                  <div className="text-label-xs text-text-secondary bg-background-subtle rounded-sm px-sm py-xs">
                    {item.notes}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Item フォーム（追加・編集共通） ──
function ItemForm({
  initial,
  isNew = false,
  onSubmit,
  onCancel,
  onDelete,
  onGenerateNotes,
  generating = false,
}: {
  initial: ItemFormValues;
  isNew?: boolean;
  onSubmit: (values: ItemFormValues) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  onGenerateNotes?: () => void;
  generating?: boolean;
}) {
  const [values, setValues] = useState<ItemFormValues>(initial);
  const [saving, setSaving] = useState(false);

  const trackingChanged = !isNew && values.trackingType !== initial.trackingType;

  const handleSubmit = async () => {
    if (!values.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-sm">
      <input
        type="text"
        value={values.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        placeholder="工具名（例: マキタ18Vバッテリー）"
        className="w-full border border-divider rounded-md px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary bg-surface"
      />
      <input
        type="text"
        value={values.itemCode}
        onChange={(e) => setValues((v) => ({ ...v, itemCode: e.target.value }))}
        placeholder="識別コード（任意）"
        className="w-full border border-divider rounded-md px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary bg-surface"
      />
      <div className="flex gap-sm">
        <select
          value={values.category}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              category: e.target.value as ItemFormValues["category"],
            }))
          }
          className="flex-1 border border-divider rounded-md px-md py-sm text-body-sm bg-surface"
        >
          <option value="tool">工具</option>
          <option value="material">資材</option>
          <option value="consumable">消耗品</option>
        </select>
        <select
          value={values.trackingType}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              trackingType: e.target.value as ItemFormValues["trackingType"],
            }))
          }
          className="flex-1 border border-divider rounded-md px-md py-sm text-body-sm bg-surface"
        >
          <option value="individual">個体管理</option>
          <option value="quantity">数量管理</option>
        </select>
      </div>
      {trackingChanged && (
        <div className="text-label-xs text-warning bg-warning/10 border border-warning rounded-md px-sm py-xs">
          ⚠ 追跡方式の変更は既存 movements の解釈を変えます。慎重に
        </div>
      )}
      <div className="flex items-end gap-sm">
        <div className="flex-1">
          <div className="text-label-xs text-text-secondary mb-xs">notes（別名・型番・用途）</div>
          <textarea
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            placeholder="別名: サンダー. メーカー: マキタ. 型番: ..."
            rows={2}
            className="w-full border border-divider rounded-md px-md py-sm text-body-sm placeholder:text-text-secondary focus:outline-none focus:border-primary bg-surface resize-y"
          />
        </div>
        {onGenerateNotes && (
          <button
            type="button"
            onClick={onGenerateNotes}
            disabled={generating}
            className="text-label-xs px-md py-sm border border-primary text-primary rounded-md disabled:opacity-40 min-h-[44px] whitespace-nowrap"
          >
            {generating ? "生成中..." : "AI 生成"}
          </button>
        )}
      </div>
      <div className="flex gap-sm mt-xs">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!values.name.trim() || saving}
          className="flex-1 bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] disabled:opacity-40 transition-all"
        >
          {saving ? "保存中..." : isNew ? "登録" : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-lg border border-divider text-text-secondary rounded-md py-sm min-h-[44px]"
        >
          取消
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-md border border-error text-error rounded-md py-sm min-h-[44px]"
          >
            削除
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Units Tab — インライン CRUD
// ============================================================================

type UnitFormValues = {
  itemId: string;
  unitNumber: string;
  notes: string;
};

function UnitsTab() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseEnabled()) {
        const { createClient } = await import("@/lib/supabase/client");
        const { listUnits, listItems } = await import("@/lib/supabase/master");
        const supabase = createClient();
        const [unitData, itemData] = await Promise.all([listUnits(supabase), listItems(supabase)]);
        setUnits(unitData);
        setItems(itemData);
      } else {
        setUnits(DEMO_UNITS);
        setItems(DEMO_ITEMS);
      }
    } catch (err) {
      console.error("listUnits failed:", err);
      setUnits(DEMO_UNITS);
      setItems(DEMO_ITEMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const individualItems = items.filter((i) => i.trackingType === "individual");

  // ── 作成 ──
  const handleCreate = useCallback(
    async (values: UnitFormValues) => {
      const num = Number.parseInt(values.unitNumber, 10);
      if (!values.itemId || Number.isNaN(num) || num <= 0) return;
      setError(null);
      try {
        if (isSupabaseEnabled()) {
          const { createClient } = await import("@/lib/supabase/client");
          const { insertUnit } = await import("@/lib/supabase/master");
          const supabase = createClient();
          await insertUnit(supabase, {
            itemId: values.itemId,
            unitNumber: num,
            notes: values.notes.trim() || null,
          });
          await reload();
        } else {
          const parent = items.find((i) => i.id === values.itemId);
          setUnits((prev) => [
            ...prev,
            {
              id: `demo-new-${Date.now()}`,
              itemId: values.itemId,
              itemName: parent?.name ?? "不明",
              unitNumber: num,
              isActive: true,
              notes: values.notes.trim() || null,
            },
          ]);
        }
        setShowCreate(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [items, reload],
  );

  // ── 更新 ──
  const handleUpdate = useCallback(
    async (id: string, unitNumber: number, notes: string) => {
      setError(null);
      try {
        if (isSupabaseEnabled()) {
          const { createClient } = await import("@/lib/supabase/client");
          const { updateUnit } = await import("@/lib/supabase/master");
          const supabase = createClient();
          await updateUnit(supabase, id, {
            unitNumber,
            notes: notes.trim() || null,
          });
          await reload();
        } else {
          setUnits((prev) =>
            prev.map((u) =>
              u.id === id
                ? { ...u, unitNumber, notes: notes.trim() || null }
                : u,
            ),
          );
        }
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [reload],
  );

  // ── 論理削除 ──
  const handleDelete = useCallback(
    async (id: string, label: string) => {
      if (!confirm(`「${label}」を削除しますか？\n(論理削除: 履歴は保持されます)`)) return;
      setError(null);
      try {
        if (isSupabaseEnabled()) {
          const { createClient } = await import("@/lib/supabase/client");
          const { deactivateUnit } = await import("@/lib/supabase/master");
          const supabase = createClient();
          await deactivateUnit(supabase, id);
          await reload();
        } else {
          setUnits((prev) => prev.filter((u) => u.id !== id));
        }
        if (editingId === id) setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [reload, editingId],
  );

  // グループ化: item ごとに表示
  const grouped = units.reduce<Record<string, Unit[]>>((acc, u) => {
    const key = u.itemName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-lg pb-lg">
      {/* 新規追加ボタン */}
      {!showCreate && (
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setEditingId(null);
          }}
          className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta mb-md transition-all"
        >
          + 個体を追加
        </button>
      )}

      {/* 追加フォーム */}
      {showCreate && (
        <div className="border border-primary rounded-lg p-md mb-md bg-primary-light/30">
          <div className="text-label-xs text-primary font-bold mb-sm">新規個体</div>
          <UnitCreateForm
            individualItems={individualItems}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="text-label-xs text-error bg-error/10 border border-error rounded-md px-md py-sm mb-md">
          {error}
        </div>
      )}

      {/* 一覧（item ごとグループ表示、各 unit はタップで展開編集） */}
      {loading ? (
        <div className="flex items-center justify-center py-xl text-text-secondary text-body-sm">
          読み込み中...
        </div>
      ) : units.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-xl gap-md text-text-secondary">
          <div className="text-[32px]">📦</div>
          <div className="text-body-md">個体が登録されていません</div>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {Object.entries(grouped).map(([itemName, groupUnits]) => (
            <div key={itemName}>
              <div className="text-label-xs text-text-secondary font-bold mb-xs">{itemName}</div>
              <div className="flex flex-col gap-xs">
                {groupUnits
                  .sort((a, b) => a.unitNumber - b.unitNumber)
                  .map((u) => {
                    const isEditing = editingId === u.id;
                    if (isEditing) {
                      return (
                        <div
                          key={u.id}
                          className="border border-primary rounded-lg p-md bg-primary-light/20"
                        >
                          <div className="text-label-xs text-primary font-bold mb-sm">
                            編集中: {itemName} #{u.unitNumber}
                          </div>
                          <UnitEditForm
                            initialUnitNumber={u.unitNumber}
                            initialNotes={u.notes ?? ""}
                            onSubmit={(num, notes) => handleUpdate(u.id, num, notes)}
                            onCancel={() => setEditingId(null)}
                            onDelete={() =>
                              handleDelete(u.id, `${itemName} #${u.unitNumber}`)
                            }
                          />
                        </div>
                      );
                    }
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setEditingId(u.id);
                          setShowCreate(false);
                        }}
                        className="bg-surface border border-divider rounded-md px-md py-sm shadow-card flex items-center gap-sm text-left hover:border-primary transition-colors min-h-[40px]"
                      >
                        <span className="bg-primary text-surface text-label-xs font-mono px-sm py-0.5 rounded-sm">
                          #{u.unitNumber}
                        </span>
                        {u.notes && (
                          <span className="text-label-xs text-text-secondary truncate flex-1">
                            {u.notes}
                          </span>
                        )}
                        <span className="text-label-xs text-primary ml-auto shrink-0">編集</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UnitCreateForm({
  individualItems,
  onSubmit,
  onCancel,
}: {
  individualItems: Item[];
  onSubmit: (values: UnitFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<UnitFormValues>({
    itemId: "",
    unitNumber: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!values.itemId || !values.unitNumber.trim()) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-sm">
      <select
        value={values.itemId}
        onChange={(e) => setValues((v) => ({ ...v, itemId: e.target.value }))}
        className="w-full border border-divider rounded-md px-md py-sm text-body-sm bg-surface"
      >
        <option value="">工具を選択...</option>
        {individualItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={values.unitNumber}
        onChange={(e) => setValues((v) => ({ ...v, unitNumber: e.target.value }))}
        placeholder="番号（例: 11）"
        min={1}
        className="w-full border border-divider rounded-md px-md py-sm text-body-md font-mono placeholder:text-text-secondary focus:outline-none focus:border-primary bg-surface"
      />
      <input
        type="text"
        value={values.notes}
        onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        placeholder="備考（任意。色違い、購入時期 等）"
        className="w-full border border-divider rounded-md px-md py-sm text-body-sm placeholder:text-text-secondary focus:outline-none focus:border-primary bg-surface"
      />
      <div className="flex gap-sm">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!values.itemId || !values.unitNumber.trim() || saving}
          className="flex-1 bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] disabled:opacity-40 transition-all"
        >
          {saving ? "保存中..." : "登録"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-lg border border-divider text-text-secondary rounded-md py-sm min-h-[44px]"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function UnitEditForm({
  initialUnitNumber,
  initialNotes,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initialUnitNumber: number;
  initialNotes: string;
  onSubmit: (unitNumber: number, notes: string) => void | Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [unitNumber, setUnitNumber] = useState(String(initialUnitNumber));
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const num = Number.parseInt(unitNumber, 10);
    if (Number.isNaN(num) || num <= 0) return;
    setSaving(true);
    try {
      await onSubmit(num, notes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center gap-sm">
        <span className="text-label-xs text-text-secondary">#</span>
        <input
          type="number"
          value={unitNumber}
          onChange={(e) => setUnitNumber(e.target.value)}
          min={1}
          className="flex-1 border border-divider rounded-md px-md py-sm text-body-md font-mono focus:outline-none focus:border-primary bg-surface"
        />
      </div>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="備考（任意）"
        className="w-full border border-divider rounded-md px-md py-sm text-body-sm placeholder:text-text-secondary focus:outline-none focus:border-primary bg-surface"
      />
      <div className="flex gap-sm">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!unitNumber.trim() || saving}
          className="flex-1 bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] disabled:opacity-40"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-lg border border-divider text-text-secondary rounded-md py-sm min-h-[44px]"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-md border border-error text-error rounded-md py-sm min-h-[44px]"
        >
          削除
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Locations Tab — 現状維持 (CRUD 統一は別タスク。本セッションでは items/units のみ)
// ============================================================================

function LocationsTab() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKind, setFormKind] = useState<"warehouse" | "site">("warehouse");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (isSupabaseEnabled()) {
          const { createClient } = await import("@/lib/supabase/client");
          const { listLocations } = await import("@/lib/supabase/master");
          const supabase = createClient();
          const data = await listLocations(supabase);
          setLocations(data);
        } else {
          setLocations(DEMO_LOCATIONS);
        }
      } catch {
        setLocations(DEMO_LOCATIONS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAdd = useCallback(async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (isSupabaseEnabled()) {
        const { createClient } = await import("@/lib/supabase/client");
        const { insertLocation, listLocations } = await import("@/lib/supabase/master");
        const supabase = createClient();
        await insertLocation(supabase, { name: formName.trim(), kind: formKind });
        const refreshed = await listLocations(supabase);
        setLocations(refreshed);
      } else {
        setLocations((prev) => [
          {
            id: `demo-new-${Date.now()}`,
            name: formName.trim(),
            kind: formKind,
            projectId: null,
            isActive: true,
          },
          ...prev,
        ]);
      }
      setFormName("");
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add location:", err);
    } finally {
      setSaving(false);
    }
  }, [formName, formKind]);

  const kindLabel = (k: string) => (k === "warehouse" ? "倉庫" : "現場");

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-lg pb-lg">
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta mb-md transition-all"
        >
          + 場所を追加
        </button>
      )}

      {showForm && (
        <div className="border border-divider rounded-lg p-md mb-md flex flex-col gap-sm bg-background-subtle">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="場所名（例: 事務所・倉庫）"
            className="w-full border border-divider rounded-md px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
          <select
            value={formKind}
            onChange={(e) => setFormKind(e.target.value as "warehouse" | "site")}
            className="w-full border border-divider rounded-md px-md py-sm text-body-sm bg-surface"
          >
            <option value="warehouse">倉庫</option>
            <option value="site">現場</option>
          </select>
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!formName.trim() || saving}
              className="flex-1 bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] disabled:opacity-40 transition-all"
            >
              {saving ? "保存中..." : "登録"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-lg border border-divider text-text-secondary rounded-md py-sm min-h-[44px]"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-xl text-text-secondary text-body-sm">
          読み込み中...
        </div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-xl gap-md text-text-secondary">
          <div className="text-[32px]">📍</div>
          <div className="text-body-md">場所が登録されていません</div>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="bg-surface border border-divider rounded-lg px-lg py-md shadow-card flex items-center gap-md min-h-[56px]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-sm">
                  <span className="text-body-md font-bold text-ink truncate">{loc.name}</span>
                  <span
                    className={`text-label-xs px-sm py-0.5 rounded-sm ${
                      loc.kind === "warehouse"
                        ? "bg-primary/10 text-primary"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {kindLabel(loc.kind)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
