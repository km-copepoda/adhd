import BottomNav from "@/components/child/BottomNav";

export default function ChildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh max-w-md mx-auto relative pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
