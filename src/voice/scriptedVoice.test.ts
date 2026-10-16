import { expect, it } from "vitest";
import { ScriptedVoice } from "./scriptedVoice";

it("plays the model's part by calling tools and collecting the app's answers", async () => {
  const voice = new ScriptedVoice();
  voice.transport.onEvent((event) => {
    if (event.type === "tool-call") void voice.transport.sendToolResult(event.callId, { echoed: event.name });
  });
  await expect(voice.callTool("getSetupStatus")).resolves.toEqual({ echoed: "getSetupStatus" });
});
