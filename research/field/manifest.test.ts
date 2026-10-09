import schema from "./manifest.schema.json";
import { expect, it } from "vitest";

it("requires the complete preregistered field observation vocabulary", () => {
  expect(schema.required).toEqual(expect.arrayContaining(["participantPseudonym", "device", "studio", "mountGeometry",
    "completion", "setupTimeSeconds", "calibrationRetries", "metricIds", "distraction", "understanding",
    "bystanderNotice", "consentRevisions", "deletionDate"]));
  expect(schema.properties.device.required).toEqual(["class", "os", "browser"]);
  expect(schema.properties.studio.required).toEqual(["light", "backdrop", "clay", "wetness"]);
});
