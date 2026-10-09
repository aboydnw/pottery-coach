# Realtime voice test protocol

Run restrained and stress scripts for 20 minutes under quiet, studio-noise, poor-network, interruption, and reconnect conditions. Capture event timestamps, tool calls, transcript consent state, usage, model/account configuration, pricing date, and cost. Compare adapters on the same supported phones. Pass requires every allow-listed tool, continuous conversation and reconnect, response p50 at most 1.5 seconds, and barge-in p95 at most 300 ms; always report p95 and failures.
