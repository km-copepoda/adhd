import ChildViewBottomNav from "@/components/parent/ChildViewBottomNav";
import ChildViewMonsterCutsceneListener from "@/components/parent/ChildViewMonsterCutsceneListener";

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
      <ChildViewMonsterCutsceneListener childId={childId} />
      <ChildViewBottomNav childId={childId} />
    </>
  );
}
