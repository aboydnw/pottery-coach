import { useEffect, useRef, useState } from "react";
import { CaptionPacer } from "./captionPacer";
import { ConversationController, type ConversationFailure } from "./ConversationController";
import { NOTICES, primeSpokenNotices, speakNotice } from "./spokenNotice";
import type { ConversationState, RealtimeCoachTransport, RealtimeSessionConfig } from "./types";

export type Caption = { id: string; speaker: "user" | "assistant"; text: string; final: boolean };
export type ToolRunner = { call(name: string, input: unknown): Promise<unknown> };

const MAX_CAPTIONS = 4;
const CAPTION_TICK_MS = 100;
/** Hang up anyway if the goodbye never finishes playing. */
const HANG_UP_TIMEOUT_MS = 20_000;
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
  const [failure, setFailure] = useState<ConversationFailure | null>(null);
  const pacerRef = useRef(new CaptionPacer(MAX_CAPTIONS));
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hangUpRef = useRef<{ heardReply: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    toolsRef.current = tools;
  });

  useEffect(
    () => () => {
      clearCaptionTicker();
      if (hangUpRef.current) clearTimeout(hangUpRef.current.timer);
      void controllerRef.current?.close();
    },
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function showCaptions(): void {
    const pacer = pacerRef.current;
    setCaptions(pacer.visible(performance.now()));
    if (!pacer.isRevealing()) clearCaptionTicker();
    else tickerRef.current ??= setInterval(showCaptions, CAPTION_TICK_MS);
  }

  function clearCaptionTicker(): void {
    if (tickerRef.current !== null) clearInterval(tickerRef.current);
    tickerRef.current = null;
  }

  async function start(config: RealtimeSessionConfig = SESSION_CONFIG): Promise<void> {
    if (!createTransport || controllerRef.current) return;
    // Runs inside the start tap, which unlocks the phone's own voice for later notices.
    primeSpokenNotices();
    const controller = new ConversationController(createTransport);
    controllerRef.current = controller;
    pacerRef.current = new CaptionPacer(MAX_CAPTIONS);
    setCaptions([]);
    setFailure(null);
    controller.onStateChange((next) => {
      setState(next);
      if (next === "reconnecting") speakNotice(NOTICES.reconnecting);
      if (next === "failed") {
        const reason = controller.getFailure();
        setFailure(reason);
        speakNotice(reason === "unauthorized" ? NOTICES.passphrase : NOTICES.lostVoice);
      }
    });
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
        pacerRef.current.update(caption, performance.now());
        showCaptions();
      }
      if (event.type === "output-started") {
        pacerRef.current.audioStarted(performance.now());
        if (hangUpRef.current) hangUpRef.current.heardReply = true;
        showCaptions();
      }
      if (event.type === "output-stopped") {
        const finished = event.reason === undefined || event.reason === "finished";
        pacerRef.current.audioStopped(performance.now(), !finished);
        showCaptions();
        if (finished && hangUpRef.current?.heardReply) void stop();
      }
    });
    await controller.connect(config);
  }

  async function stop(): Promise<void> {
    const controller = controllerRef.current;
    controllerRef.current = null;
    if (hangUpRef.current) clearTimeout(hangUpRef.current.timer);
    hangUpRef.current = null;
    await controller?.close();
    setState("off");
  }

  /** Lets the coach finish its next reply (the goodbye), then ends the call. */
  function hangUpAfterReply(): void {
    if (!controllerRef.current || hangUpRef.current) return;
    hangUpRef.current = { heardReply: false, timer: setTimeout(() => void stop(), HANG_UP_TIMEOUT_MS) };
  }

  /** Tries again after a failure; called from the one tap the failure notice asks for. */
  async function restart(): Promise<void> {
    await stop();
    await start();
  }

  return { available: createTransport !== null, state, failure, captions, start, stop, restart, hangUpAfterReply };
}
