import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-graphite">
      <AdminSidebar />
      {/* Content area — offset by sidebar width */}
      <main className="ml-64 min-h-screen">
        <div className="max-w-screen-xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
