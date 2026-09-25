import { MechanicSidebar } from "@/components/mechanic/MechanicSidebar";

export default function MechanicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-graphite">
      <MechanicSidebar />
      {/* Content area — offset by sidebar width (ml-64) */}
      <main className="ml-64 min-h-screen">
        <div className="max-w-screen-xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
