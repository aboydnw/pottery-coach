import { useEffect, useRef, useState } from "react";
import { ConversationController } from "./ConversationController";
import type { ConversationState, RealtimeCoachTransport, RealtimeSessionConfig } from "./types";

export type Caption = { id: string; speaker: "user" | "assistant"; text: string; final: boolean };
export type ToolRunner = { call(name: string, input: unknown): Promise<unknown> };

const MAX_CAPTIONS = 4;
const SESSION_CONFIG: RealtimeSessionConfig = {
  provider: "openai",
  model: "server-owned",
  voice: "server-owned",
  language: "en",
  instructionsRevision: "voice-first-v1",
  toolsRevision: "voice-first-v1",
};

/**
 * Runs one spoken conversation: connects through the transport factory, answers the model's tool
 * calls with `tools`, and keeps recent captions. Works with any transport, including the mock.
 */
export function useVoiceSession(createTransport: (() => RealtimeCoachTransport) | null, tools: ToolRunner) {
  const controllerRef = useRef<ConversationController | null>(null);
  const toolsRef = useRef(tools);
  const [state, setState] = useState<ConversationState | "off">("off");
  const [captions, setCaptions] = useState<Caption[]>([]);

  useEffect(() => {
    toolsRef.current = tools;
  });

  useEffect(() => () => void controllerRef.current?.close(), []);

  async function start(config: RealtimeSessionConfig = SESSION_CONFIG): Promise<void> {
    if (!createTransport || controllerRef.current) return;
    const controller = new ConversationController(createTransport);
    controllerRef.current = controller;
    controller.onStateChange(setState);
    controller.onEvent((event) => {
      if (event.type === "tool-call") {
        void toolsRef.current
          .call(event.name, event.arguments)
          .catch((error: unknown) => ({ error: error instanceof Error ? error.message : "Tool failed" }))
          .then((result) => controller.sendToolResult(event.callId, result));
      }
      if (event.type === "transcript-delta" || event.type === "transcript-final") {
        const caption: Caption = {
          id: event.eventId,
          speaker: event.speaker,
          text: event.text,
          final: event.type === "transcript-final",
        };
        setCaptions((current) => [...current.filter((item) => item.id !== caption.id), caption].slice(-MAX_CAPTIONS));
      }
    });
    await controller.connect(config);
  }

  async function stop(): Promise<void> {
    const controller = controllerRef.current;
    controllerRef.current = null;
    await controller?.close();
    setState("off");
  }

  return { available: createTransport !== null, state, captions, start, stop };
}
