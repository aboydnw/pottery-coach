import straight from "./templates/straight-cylinder-v1.json";
import tapered from "./templates/tapered-cylinder-v1.json";
import { targetProfileSchema } from "./schema";
import type { TargetProfile } from "./types";

export function loadTemplates(): TargetProfile[] {
  return [straight, tapered]
    .map((template) => targetProfileSchema.parse(template) as TargetProfile)
    .sort((left, right) => left.id.localeCompare(right.id));
}
