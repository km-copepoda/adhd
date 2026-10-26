/** Prisma の unique 制約違反 (P2002) かどうか */
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002"
  );
}
