import { z } from "zod";

const sampleSchema = z.object({
  heightRatio: z.number().min(0).max(1),
  radiusToHeightRatio: z.number().nonnegative(),
});

export const targetProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().positive(),
  normalizedRadiusByHeight: z.array(sampleSchema).length(101).superRefine((samples, context) => {
    for (let index = 0; index < samples.length; index += 1) {
      if (Math.abs(samples[index]!.heightRatio - index / 100) > 1e-9) {
        context.addIssue({ code: "custom", message: "height ratios must be monotonic 0.00 through 1.00", path: [index, "heightRatio"] });
      }
    }
  }),
  intendedWetHeightMm: z.number().positive(),
  shrinkageFraction: z.number().min(0).max(0.25).nullable(),
  source: z.enum(["curated-template", "reference-image", "manual-trace"]),
  confidence: z.number().min(0).max(1),
  exclusions: z.array(z.string()),
  provenance: z.string().min(1),
  generator: z.object({ kind: z.literal("linear"), bottomRadiusRatio: z.number().nonnegative(), topRadiusRatio: z.number().nonnegative() }),
});
