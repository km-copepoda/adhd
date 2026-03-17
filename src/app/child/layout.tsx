import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BottomNav from "@/components/child/BottomNav";

export default async function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    redirect("/child/onboarding");
  }

  return (
    <div className="min-h-dvh max-w-md mx-auto relative pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
