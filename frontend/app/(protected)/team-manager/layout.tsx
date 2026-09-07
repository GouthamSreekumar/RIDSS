import { TeamManagerSidebar } from "@/components/team-manager/TeamManagerSidebar";

export default function TeamManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-graphite">
      <TeamManagerSidebar />
      {/* Content area — offset by sidebar width */}
      <main className="ml-64 min-h-screen">
        <div className="max-w-screen-xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
