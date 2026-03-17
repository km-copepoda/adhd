import Sidebar from "@/components/parent/Sidebar";
import PushSubscriber from "@/components/parent/PushSubscriber";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <PushSubscriber />
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
