import { z } from "zod";
import { MAX_POTTER_CONTEXT_LENGTH } from "./instructions";

export const realtimeSessionRequestSchema = z.object({
  sdp: z
    .string()
    .min(20)
    .max(100_000)
    .refine((value) => value.startsWith("v=0"), "Invalid SDP offer"),
  sessionId: z.string().uuid(),
  clientConfigVersion: z.literal("voice-v1"),
  potterContext: z.string().max(MAX_POTTER_CONTEXT_LENGTH).optional(),
});

export type RealtimeSessionRequest = z.infer<typeof realtimeSessionRequestSchema>;
