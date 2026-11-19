export const fieldHintId = (id: string) => `${id}-hint`;
export const fieldErrorId = (id: string) => `${id}-error`;

export function fieldAria(id: string, { error, hint }: { error?: string; hint?: string }) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? fieldErrorId(id) : hint ? fieldHintId(id) : undefined,
  } as const;
}
