import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DataManagement } from "@/components/data-management";

export default function Layout({ children }: { children: React.ReactNode }) {
  // Custom sidebar width for a more spacious feel
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex min-h-screen w-full bg-background font-sans">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center h-14 border-b px-4 gap-4 bg-card/50 backdrop-blur sticky top-0 z-10 justify-between">
            <div className="flex items-center gap-4">
                <SidebarTrigger />
            </div>
            <DataManagement />
          </header>
          <main className="flex-1 overflow-auto p-6 bg-slate-50/50">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
