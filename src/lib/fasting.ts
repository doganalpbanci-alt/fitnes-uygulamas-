/** Oruç + yeme penceresinin birlikte 24 saati tamamladığını varsayar. */
export function eatingHoursFor(targetHours: number): number {
  return Math.max(0, 24 - targetHours);
}
