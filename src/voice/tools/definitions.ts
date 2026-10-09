const empty = { type: "object", properties: {}, additionalProperties: false } as const;
export const REALTIME_TOOL_DEFINITIONS = [
  { type: "function", name: "setGoal", description: "Set an explicit wet or fired target goal.", parameters: { type: "object",
    properties: { id: { type: "string" }, targetId: { type: "string" }, basis: { enum: ["wet", "fired"] },
      desiredHeightMm: { type: "number" }, desiredMaximumWidthMm: { type: ["number", "null"] }, shrinkageFraction: { type: ["number", "null"] } },
    required: ["id", "targetId", "basis", "desiredHeightMm", "desiredMaximumWidthMm", "shrinkageFraction"], additionalProperties: false } },
  { type: "function", name: "getCurrentDimensions", description: "Read current eligible visible dimensions.", parameters: empty },
  { type: "function", name: "getWobbleStatus", description: "Read current visible rotational stability evidence.", parameters: empty },
  { type: "function", name: "compareTargetProfile", description: "Read the evidence-backed target comparison.", parameters: empty },
  { type: "function", name: "getMeasurementConfidence", description: "Read measurement confidence and limitations.", parameters: empty },
  { type: "function", name: "pauseCoaching", description: "Pause coaching.", parameters: empty },
  { type: "function", name: "resumeCoaching", description: "Resume coaching.", parameters: empty },
  { type: "function", name: "markMoment", description: "Mark a local session moment.", parameters: { type: "object",
    properties: { label: { type: "string", maxLength: 100 } }, additionalProperties: false } },
] as const;
