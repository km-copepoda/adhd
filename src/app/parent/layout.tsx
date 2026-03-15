import Sidebar from "@/components/parent/Sidebar";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
