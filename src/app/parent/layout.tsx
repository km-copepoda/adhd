import Sidebar from "@/components/parent/Sidebar";
import ParentBottomNav from "@/components/parent/ParentBottomNav";
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
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 pb-24 md:pb-8">{children}</main>
      <ParentBottomNav />
    </div>
  );
}
