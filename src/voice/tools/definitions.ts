const empty = { type: "object", properties: {}, additionalProperties: false } as const;
const length = {
  type: "object",
  properties: { value: { type: "number" }, unit: { enum: ["mm", "cm", "in"] } },
  required: ["value", "unit"],
  additionalProperties: false,
} as const;
const confirmed = {
  type: "object",
  properties: { confirmed: { type: "boolean" } },
  required: ["confirmed"],
  additionalProperties: false,
} as const;

/** Function tools offered to the realtime model. The server injects these; clients cannot change them. */
export const REALTIME_TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "getSetupStatus",
    description:
      "What setup still needs (missing or unconfirmed slots) and a one-sentence summary. Call at the start and whenever unsure.",
    parameters: empty,
  },
  {
    type: "function",
    name: "proposeSetup",
    description:
      "Record setup values exactly as the potter said them (numbers and units as spoken; never convert). Any subset may be given. Returns a readback to say verbatim; values only count after confirmSetup.",
    parameters: {
      type: "object",
      properties: {
        wheelHeadDiameter: length,
        targetId: { enum: ["straight-cylinder-v1", "tapered-cylinder-v1"] },
        goal: {
          type: "object",
          properties: {
            height: length,
            basis: { enum: ["wet", "fired"] },
            shrinkagePercent: { type: ["number", "null"] },
          },
          required: ["height", "basis"],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "confirmSetup",
    description: "Call only after the potter clearly agrees with the readback.",
    parameters: empty,
  },
  {
    type: "function",
    name: "loadLastSetup",
    description: "Use when the potter says 'same as last time'. Returns a readback to confirm, or found: false.",
    parameters: empty,
  },
  {
    type: "function",
    name: "checkWheelHead",
    description:
      "Find the wheel head's edges and show two yellow markers on screen. Needs a confirmed wheel-head diameter. Use fresh: true if the phone moved.",
    parameters: { type: "object", properties: { fresh: { type: "boolean" } }, additionalProperties: false },
  },
  {
    type: "function",
    name: "adjustWheelMarker",
    description:
      "Move one marker: 'out' is away from the wheel's centre, 'in' toward it. 'a bit' is small, 'a lot' is large.",
    parameters: {
      type: "object",
      properties: {
        side: { enum: ["left", "right"] },
        direction: { enum: ["in", "out"] },
        size: { enum: ["small", "large"] },
      },
      required: ["side", "direction", "size"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "confirmWheelHead",
    description: "Call after the potter says the markers sit on the edges.",
    parameters: empty,
  },
  {
    type: "function",
    name: "skipCalibration",
    description: "The potter doesn't want sizes; coach on shape and proportions only.",
    parameters: empty,
  },
  {
    type: "function",
    name: "getCurrentDimensions",
    description: "Read the current visible height and widths (or proportions before calibration).",
    parameters: empty,
  },
  {
    type: "function",
    name: "getWobbleStatus",
    description: "Read current visible rotational stability evidence.",
    parameters: empty,
  },
  {
    type: "function",
    name: "compareTargetProfile",
    description: "Compare the current shape (and size, once calibrated) with the target.",
    parameters: empty,
  },
  {
    type: "function",
    name: "getMeasurementConfidence",
    description: "Read measurement confidence and limitations.",
    parameters: empty,
  },
  { type: "function", name: "pauseCoaching", description: "Pause coaching.", parameters: empty },
  { type: "function", name: "resumeCoaching", description: "Resume coaching.", parameters: empty },
  {
    type: "function",
    name: "markMoment",
    description: "Mark a local session moment.",
    parameters: {
      type: "object",
      properties: { label: { type: "string", maxLength: 100 } },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "endSession",
    description:
      "End the session. Call with confirmed: false first to get the consequence to read out; call with confirmed: true only after the potter agrees.",
    parameters: confirmed,
  },
  {
    type: "function",
    name: "getSessionSummary",
    description: "Facts for a short spoken debrief after the session ends.",
    parameters: empty,
  },
  {
    type: "function",
    name: "deleteSession",
    description:
      "Delete the finished session from this device. Call with confirmed: false first, then confirmed: true only after the potter agrees.",
    parameters: confirmed,
  },
] as const;
