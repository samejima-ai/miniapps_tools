"use client";

/**
 * Master Page — F6 マスタ管理（items / individual_units / locations 最小）
 *
 * MVP は最小機能: 一覧 + 新規作成 + 論理削除（is_active=false）。
 * 物理削除は禁止。
 *
 * 罠A遵守: items/individual_units に status カラムは存在しない。
 * 状態は View 経由で導出する。
 */

import { useCallback, useEffect, useState } from "react";

type MasterTab = "items" | "units" | "locations";

// ============================================================================
// デモデータ（Supabase 未接続時）
// ============================================================================

type DemoItem = {
  id: string;
  name: string;
  category: "tool" | "material" | "consumable";
  trackingType: "individual" | "quantity";
  itemCode: string | null;
  notes: string | null;
  isActive: boolean;
};

type DemoUnit = {
  id: string;
  itemId: string;
  itemName: string;
  unitNumber: number;
  isActive: boolean;
  notes: string | null;
};

type DemoLocation = {
  id: string;
  name: string;
  kind: "warehouse" | "site";
  projectId: string | null;
  isActive: boolean;
};

const DEMO_ITEMS: DemoItem[] = [
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
  {
    id: "demo-item-3",
    name: "レーザー墨出し器",
    category: "tool",
    trackingType: "individual",
    itemCode: null,
    notes: "高額機器・取扱注意",
    isActive: true,
  },
  {
    id: "demo-item-4",
    name: "養生テープ",
    category: "consumable",
    trackingType: "quantity",
    itemCode: null,
    notes: null,
    isActive: true,
  },
];

const DEMO_UNITS: DemoUnit[] = [
  {
    id: "demo-unit-1",
    itemId: "demo-item-1",
    itemName: "マキタ18Vバッテリー",
    unitNumber: 7,
    isActive: true,
    notes: null,
  },
  {
    id: "demo-unit-2",
    itemId: "demo-item-1",
    itemName: "マキタ18Vバッテリー",
    unitNumber: 8,
    isActive: true,
    notes: null,
  },
  {
    id: "demo-unit-3",
    itemId: "demo-item-1",
    itemName: "マキタ18Vバッテリー",
    unitNumber: 9,
    isActive: true,
    notes: null,
  },
  {
    id: "demo-unit-4",
    itemId: "demo-item-1",
    itemName: "マキタ18Vバッテリー",
    unitNumber: 10,
    isActive: true,
    notes: null,
  },
  {
    id: "demo-unit-5",
    itemId: "demo-item-2",
    itemName: "インパクトドライバー",
    unitNumber: 1,
    isActive: true,
    notes: null,
  },
  {
    id: "demo-unit-6",
    itemId: "demo-item-2",
    itemName: "インパクトドライバー",
    unitNumber: 2,
    isActive: true,
    notes: null,
  },
  {
    id: "demo-unit-7",
    itemId: "demo-item-2",
    itemName: "インパクトドライバー",
    unitNumber: 3,
    isActive: true,
    notes: null,
  },
  {
    id: "demo-unit-8",
    itemId: "demo-item-3",
    itemName: "レーザー墨出し器",
    unitNumber: 1,
    isActive: true,
    notes: null,
  },
];

const DEMO_LOCATIONS: DemoLocation[] = [
  { id: "demo-loc-1", name: "本社倉庫", kind: "warehouse", projectId: null, isActive: true },
  { id: "demo-loc-2", name: "池下現場", kind: "site", projectId: null, isActive: true },
  { id: "demo-loc-3", name: "名駅現場", kind: "site", projectId: null, isActive: true },
];

// ============================================================================
// Tab Selector
// ============================================================================

const TABS: Array<{ key: MasterTab; label: string }> = [
  { key: "items", label: "工具" },
  { key: "units", label: "個体" },
  { key: "locations", label: "場所" },
];

// ============================================================================
// Page Component
// ============================================================================

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
// Items Tab
// ============================================================================

function ItemsTab() {
  const [items, setItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<"tool" | "material" | "consumable">("tool");
  const [formTrackingType, setFormTrackingType] = useState<"individual" | "quantity">("individual");
  const [formItemCode, setFormItemCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState<Set<string>>(new Set());
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          const { createClient } = await import("@/lib/supabase/client");
          const { listItems } = await import("@/lib/supabase/master");
          const supabase = createClient();
          const data = await listItems(supabase);
          setItems(data);
        } else {
          setItems(DEMO_ITEMS);
        }
      } catch {
        setItems(DEMO_ITEMS);
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
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { createClient } = await import("@/lib/supabase/client");
        const { insertItem, listItems } = await import("@/lib/supabase/master");
        const supabase = createClient();
        await insertItem(supabase, {
          name: formName.trim(),
          category: formCategory,
          trackingType: formTrackingType,
          itemCode: formItemCode.trim() || null,
        });
        // 再読込で実データを反映
        const refreshed = await listItems(supabase);
        setItems(refreshed);
      } else {
        // デモモード: ローカルに追加
        setItems((prev) => [
          {
            id: `demo-new-${Date.now()}`,
            name: formName.trim(),
            category: formCategory,
            trackingType: formTrackingType,
            itemCode: formItemCode.trim() || null,
            notes: null,
            isActive: true,
          },
          ...prev,
        ]);
      }
      setFormName("");
      setFormItemCode("");
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add item:", err);
    } finally {
      setSaving(false);
    }
  }, [formName, formCategory, formTrackingType, formItemCode]);

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

  const handleGenerateNotes = useCallback(async (itemId: string) => {
    setGenError(null);
    setGenLoading((prev) => new Set(prev).add(itemId));
    try {
      const { generateNotesForItem } = await import("./notes-actions");
      const result = await generateNotesForItem(itemId);
      if (result.ok) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, notes: result.notes } : it)),
        );
      } else {
        setGenError(`${itemId.slice(0, 8)}: ${result.error}`);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
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
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta mb-md transition-all"
        >
          + 工具を追加
        </button>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <div className="border border-divider rounded-lg p-md mb-md flex flex-col gap-sm bg-background-subtle">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="工具名（例: マキタ18Vバッテリー）"
            className="w-full border border-divider rounded-md px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            value={formItemCode}
            onChange={(e) => setFormItemCode(e.target.value)}
            placeholder="識別コード（任意）"
            className="w-full border border-divider rounded-md px-md py-sm text-body-md placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
          <div className="flex gap-sm">
            <select
              value={formCategory}
              onChange={(e) =>
                setFormCategory(e.target.value as "tool" | "material" | "consumable")
              }
              className="flex-1 border border-divider rounded-md px-md py-sm text-body-sm bg-surface"
            >
              <option value="tool">工具</option>
              <option value="material">資材</option>
              <option value="consumable">消耗品</option>
            </select>
            <select
              value={formTrackingType}
              onChange={(e) => setFormTrackingType(e.target.value as "individual" | "quantity")}
              className="flex-1 border border-divider rounded-md px-md py-sm text-body-sm bg-surface"
            >
              <option value="individual">個体管理</option>
              <option value="quantity">数量管理</option>
            </select>
          </div>
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
          {genError && (
            <div className="text-label-xs text-error bg-error/10 border border-error rounded-md px-md py-sm">
              {genError}
            </div>
          )}
          {items.map((item) => {
            const generating = genLoading.has(item.id);
            return (
              <div
                key={item.id}
                className="bg-surface border border-divider rounded-lg px-lg py-md shadow-card flex flex-col gap-sm"
              >
                <div className="flex items-start gap-md">
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
                  <button
                    type="button"
                    onClick={() => handleGenerateNotes(item.id)}
                    disabled={generating}
                    className="text-label-xs px-md py-xs border border-divider rounded-md text-primary hover:bg-primary-light disabled:opacity-40 min-h-[36px] whitespace-nowrap"
                    title={item.notes ? "notes を再生成（上書き）" : "AI で notes を生成"}
                  >
                    {generating ? "生成中..." : item.notes ? "AI 再生成" : "AI 生成"}
                  </button>
                </div>
                {item.notes && (
                  <div className="text-label-xs text-text-secondary bg-background-subtle rounded-sm px-sm py-xs">
                    {item.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Units Tab
// ============================================================================

function UnitsTab() {
  const [units, setUnits] = useState<DemoUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formItemId, setFormItemId] = useState("");
  const [formUnitNumber, setFormUnitNumber] = useState("");
  const [items, setLocalItems] = useState<DemoItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          const { createClient } = await import("@/lib/supabase/client");
          const { listUnits, listItems } = await import("@/lib/supabase/master");
          const supabase = createClient();
          const [unitData, itemData] = await Promise.all([
            listUnits(supabase),
            listItems(supabase),
          ]);
          setUnits(unitData);
          setLocalItems(itemData);
        } else {
          setUnits(DEMO_UNITS);
          setLocalItems(DEMO_ITEMS);
        }
      } catch {
        setUnits(DEMO_UNITS);
        setLocalItems(DEMO_ITEMS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // individual 追跡のみ個体登録可
  const individualItems = items.filter((i) => i.trackingType === "individual");

  const handleAdd = useCallback(async () => {
    const num = Number.parseInt(formUnitNumber, 10);
    if (!formItemId || Number.isNaN(num) || num <= 0) return;

    setSaving(true);
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { createClient } = await import("@/lib/supabase/client");
        const { insertUnit, listUnits } = await import("@/lib/supabase/master");
        const supabase = createClient();
        await insertUnit(supabase, { itemId: formItemId, unitNumber: num });
        // 再読込で実データを反映
        const refreshed = await listUnits(supabase);
        setUnits(refreshed);
      } else {
        const parentItem = items.find((i) => i.id === formItemId);
        setUnits((prev) => [
          ...prev,
          {
            id: `demo-new-${Date.now()}`,
            itemId: formItemId,
            itemName: parentItem?.name ?? "不明",
            unitNumber: num,
            isActive: true,
            notes: null,
          },
        ]);
      }
      setFormUnitNumber("");
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add unit:", err);
    } finally {
      setSaving(false);
    }
  }, [formItemId, formUnitNumber, items]);

  // グループ化: item ごとにまとめて表示
  const grouped = units.reduce<Record<string, DemoUnit[]>>((acc, u) => {
    const key = u.itemName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-lg pb-lg">
      {/* 新規追加ボタン */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta mb-md transition-all"
        >
          + 個体を追加
        </button>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <div className="border border-divider rounded-lg p-md mb-md flex flex-col gap-sm bg-background-subtle">
          <select
            value={formItemId}
            onChange={(e) => setFormItemId(e.target.value)}
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
            value={formUnitNumber}
            onChange={(e) => setFormUnitNumber(e.target.value)}
            placeholder="番号（例: 11）"
            min={1}
            className="w-full border border-divider rounded-md px-md py-sm text-body-md font-mono placeholder:text-text-secondary focus:outline-none focus:border-primary"
          />
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!formItemId || !formUnitNumber.trim() || saving}
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

      {/* 一覧 */}
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
              <div className="flex flex-wrap gap-xs">
                {groupUnits.map((u) => (
                  <span
                    key={u.id}
                    className="bg-primary text-surface text-label-xs font-mono px-sm py-0.5 rounded-sm"
                  >
                    #{u.unitNumber}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Locations Tab
// ============================================================================

function LocationsTab() {
  const [locations, setLocations] = useState<DemoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKind, setFormKind] = useState<"warehouse" | "site">("warehouse");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { createClient } = await import("@/lib/supabase/client");
        const { insertLocation, listLocations } = await import("@/lib/supabase/master");
        const supabase = createClient();
        await insertLocation(supabase, { name: formName.trim(), kind: formKind });
        // 再読込で実データを反映
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
      {/* 新規追加ボタン */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-primary text-surface font-bold rounded-md py-sm min-h-[44px] shadow-primary-cta mb-md transition-all"
        >
          + 場所を追加
        </button>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <div className="border border-divider rounded-lg p-md mb-md flex flex-col gap-sm bg-background-subtle">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="場所名（例: 本社倉庫）"
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

      {/* 一覧 */}
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
