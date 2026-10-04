import { StrategyEngineerSidebar } from "@/components/strategy-engineer/StrategyEngineerSidebar";

export default function StrategyEngineerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-graphite text-slate-100 font-sans">
      <StrategyEngineerSidebar />
      <main className="ml-64 min-h-screen">
        <div className="max-w-7xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
