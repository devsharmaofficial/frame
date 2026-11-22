export type Paise = number;

export function validatePaise(v: unknown): v is Paise {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}
