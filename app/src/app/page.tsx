export default function HomePage() {
  return (
    <main className="p-lg flex-1 flex flex-col items-center justify-center gap-md">
      <div className="text-headline-lg font-black">工具管理</div>
      <div className="text-body-sm text-text-secondary">MVP scaffold — L1 着手前</div>
      <div className="bg-surface border border-divider rounded-lg p-lg w-full text-body-md">
        L0 仕様策定完了。L1 (autonomous-dev) で実装を開始してください。
        <ul className="list-disc pl-lg mt-md space-y-xs text-body-sm">
          <li>SPEC.md / DESIGN.md / DONT.md を参照</li>
          <li>spec/domain.ts と supabase/migrations/0001_init_miniapps_tools.sql が SSOT</li>
          <li>罠A・append-only・holder≠moved_by を厳守</li>
        </ul>
      </div>
    </main>
  );
}
