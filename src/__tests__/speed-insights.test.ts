import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("RootLayout: Vercel Speed Insights", () => {
  const layoutSource = readFileSync(
    path.resolve(__dirname, "../app/layout.tsx"),
    "utf-8"
  );

  it("imports SpeedInsights from @vercel/speed-insights/next", () => {
    expect(layoutSource).toMatch(/from ["']@vercel\/speed-insights\/next["']/);
  });

  it("renders <SpeedInsights /> inside the layout", () => {
    expect(layoutSource).toMatch(/<SpeedInsights\b/);
  });
});
