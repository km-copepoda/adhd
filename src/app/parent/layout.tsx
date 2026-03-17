import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/parent/Sidebar";
import ParentBottomNav from "@/components/parent/ParentBottomNav";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 pb-24 md:pb-8">{children}</main>
      <ParentBottomNav />
    </div>
  );
}
