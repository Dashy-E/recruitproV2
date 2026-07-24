import { createId } from "@paralleldrive/cuid2";

// Single source of truth for row IDs across every table. Oracle has no
// equivalent of Prisma's @default(cuid()), so every insert must generate its
// own id here rather than relying on ad hoc Date.now()/Math.random() strings.
export function newId(): string {
  return createId();
}
