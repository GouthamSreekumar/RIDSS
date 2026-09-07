import { RaceEngineerSidebar } from "@/components/race-engineer/RaceEngineerSidebar";

export default function RaceEngineerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <RaceEngineerSidebar />
      <main className="ml-64 min-h-screen">
        <div className="max-w-7xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
