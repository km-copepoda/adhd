import confetti from "canvas-confetti";

const COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"];

export function fireCompletionConfetti(allDone: boolean = false): void {
  const particleCount = allDone ? 180 : 100;
  const spread = allDone ? 80 : 60;

  confetti({
    particleCount,
    spread,
    origin: { x: 0.5, y: 0.6 },
    colors: COLORS,
    zIndex: 9999,
  });

  if (allDone) {
    setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: COLORS,
        zIndex: 9999,
      });
    }, 200);
    setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: COLORS,
        zIndex: 9999,
      });
    }, 400);
  }
}
