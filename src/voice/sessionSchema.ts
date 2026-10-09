import { z } from "zod";

export const realtimeSessionRequestSchema = z.object({
  sdp: z.string().min(20).max(100_000).refine((value) => value.startsWith("v=0"), "Invalid SDP offer"),
  sessionId: z.string().uuid(),
  clientConfigVersion: z.literal("voice-v1"),
});

export type RealtimeSessionRequest = z.infer<typeof realtimeSessionRequestSchema>;
