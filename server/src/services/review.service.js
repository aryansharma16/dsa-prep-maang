// Spaced repetition ladder. Solving something schedules it to come back; how
// confident you felt stretches or compresses the gap.
const LADDER_DAYS = [3, 7, 21, 60];

const confidenceMultiplier = (confidence) => {
  if (confidence <= 1) return 0.4;
  if (confidence === 2) return 0.7;
  if (confidence === 3) return 1;
  if (confidence === 4) return 1.4;
  return 2;
};

export function nextReview(stage, confidence = 3, from = new Date()) {
  const baseDays = LADDER_DAYS[Math.min(stage, LADDER_DAYS.length - 1)];
  const days = Math.max(1, Math.round(baseDays * confidenceMultiplier(confidence)));
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return { nextReviewAt: date, days };
}
