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
    name: "switchWheelEdges",
    description:
      "Jump the yellow lines to the next edges found: inner when they're on a tray or splash pan around the wheel head, outer when they're inside it.",
    parameters: {
      type: "object",
      properties: { toward: { enum: ["inner", "outer"] } },
      required: ["toward"],
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
    name: "nextPiece",
    description:
      "Save the current pot to the throw log and start the next one; the empty wheel is looked at again. Call with confirmed: false first, then confirmed: true after the potter agrees.",
    parameters: confirmed,
  },
  {
    type: "function",
    name: "reportTrueSize",
    description:
      "Record a size the potter measured themselves (numbers and units exactly as spoken), to check the app's accuracy. Doesn't change any readings.",
    parameters: {
      type: "object",
      properties: {
        dimension: { enum: ["height", "width"] },
        value: { type: "number" },
        unit: { enum: ["mm", "cm", "in"] },
      },
      required: ["dimension", "value", "unit"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "rateLastCue",
    description: "Record how the potter reacted to the most recent unprompted cue.",
    parameters: {
      type: "object",
      properties: { verdict: { enum: ["helpful", "wrong", "not-now"] } },
      required: ["verdict"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "rememberNote",
    description:
      "Remember something the potter said, in their words, under 100 characters. lasting: true for preferences and things they're working on in general (kept across sessions); false for this pot only.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" }, lasting: { type: "boolean" } },
      required: ["text", "lasting"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "forgetNote",
    description:
      "Forget a lasting note. Call with confirmed: false to find the closest match and read it back, then confirmed: true after a yes.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" }, confirmed: { type: "boolean" } },
      required: ["text", "confirmed"],
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
] as const;
