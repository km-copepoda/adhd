import ChildViewBottomNav from "@/components/parent/ChildViewBottomNav";

export default async function ChildViewChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  return (
    <>
      {children}
      <ChildViewBottomNav childId={childId} />
    </>
  );
}
