import { useEffect, useRef, useState } from "react";
import { CaptionPacer } from "./captionPacer";
import { ConversationController, type ConversationFailure } from "./ConversationController";
import { NOTICES, primeSpokenNotices, speakNotice } from "./spokenNotice";
import type { ConversationState, ProviderUsage, RealtimeCoachTransport, RealtimeSessionConfig } from "./types";

export type Caption = { id: string; speaker: "user" | "assistant"; text: string; final: boolean };
export type ToolRunner = { call(name: string, input: unknown): Promise<unknown> };
export type VoiceSessionOptions = {
  /** Token usage after each reply, for the throw log's cost estimate. */
  onUsage?(usage: ProviderUsage): void;
  /** What the coach should know about the potter when a call starts. */
  getPotterContext?(): string;
};

const MAX_CAPTIONS = 4;
const CAPTION_TICK_MS = 100;
/** Hang up anyway if the goodbye never finishes playing. */
const HANG_UP_TIMEOUT_MS = 20_000;
/** A call left running (say, picking up studio noise) can't run up the bill past this. */
export const MAX_CALL_MS = 60 * 60_000;

export type VoiceFailure = ConversationFailure | "time-limit";
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
export function useVoiceSession(
  createTransport: (() => RealtimeCoachTransport) | null,
  tools: ToolRunner,
  options: VoiceSessionOptions = {},
) {
  const controllerRef = useRef<ConversationController | null>(null);
  const toolsRef = useRef(tools);
  const optionsRef = useRef(options);
  const speakingRef = useRef({ potter: false, coach: false });
  const [state, setState] = useState<ConversationState | "off">("off");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [failure, setFailure] = useState<VoiceFailure | null>(null);
  const pacerRef = useRef(new CaptionPacer(MAX_CAPTIONS));
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hangUpRef = useRef<{ heardReply: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const callLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    toolsRef.current = tools;
    optionsRef.current = options;
  });

  useEffect(
    () => () => {
      clearCaptionTicker();
      if (hangUpRef.current) clearTimeout(hangUpRef.current.timer);
      if (callLimitRef.current) clearTimeout(callLimitRef.current);
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
      if (event.type === "usage") optionsRef.current.onUsage?.(event.usage);
      if (event.type === "speech-started") speakingRef.current.potter = true;
      if (event.type === "speech-stopped") speakingRef.current.potter = false;
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
        speakingRef.current.coach = true;
        pacerRef.current.audioStarted(performance.now());
        if (hangUpRef.current) hangUpRef.current.heardReply = true;
        showCaptions();
      }
      if (event.type === "output-stopped") {
        speakingRef.current.coach = false;
        const finished = event.reason === undefined || event.reason === "finished";
        pacerRef.current.audioStopped(performance.now(), !finished);
        showCaptions();
        if (finished && hangUpRef.current?.heardReply) void stop();
      }
    });
    callLimitRef.current = setTimeout(() => {
      void stop().then(() => {
        setFailure("time-limit");
        speakNotice(NOTICES.timeLimit);
      });
    }, MAX_CALL_MS);
    const potterContext = optionsRef.current.getPotterContext?.();
    await controller.connect(potterContext ? { ...config, potterContext } : config);
  }

  /** Whether someone is talking right now, so cues wait their turn. */
  function isBusy(): boolean {
    return speakingRef.current.potter || speakingRef.current.coach;
  }

  /** Speaks one approved cue line in the coach's voice; false when there's no call to speak on. */
  function speakCue(id: string, text: string): boolean {
    const controller = controllerRef.current;
    if (!controller || controller.getState() !== "connected") return false;
    void controller.speakCue({ id, text, evidenceIds: [] });
    return true;
  }

  /** Tells the coach what it now knows about the potter (notes changed mid-call). */
  function setPotterContext(potterContext: string): void {
    void controllerRef.current?.setPotterContext(potterContext);
  }

  async function stop(): Promise<void> {
    const controller = controllerRef.current;
    controllerRef.current = null;
    if (hangUpRef.current) clearTimeout(hangUpRef.current.timer);
    hangUpRef.current = null;
    speakingRef.current = { potter: false, coach: false };
    if (callLimitRef.current) clearTimeout(callLimitRef.current);
    callLimitRef.current = null;
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

  return {
    available: createTransport !== null,
    state,
    failure,
    captions,
    start,
    stop,
    restart,
    hangUpAfterReply,
    isBusy,
    speakCue,
    setPotterContext,
  };
}
