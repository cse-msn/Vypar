/** Escape user input so it can be safely used inside a RegExp (prevents ReDoS/injection). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
