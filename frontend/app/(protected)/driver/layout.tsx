import { DriverSidebar } from "@/components/driver/DriverSidebar";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-graphite">
      <DriverSidebar />
      {/* Content area — offset by sidebar width */}
      <main className="ml-64 min-h-screen">
        <div className="max-w-screen-xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
