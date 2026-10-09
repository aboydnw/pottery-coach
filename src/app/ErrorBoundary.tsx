import { Component, type ErrorInfo, type ReactNode } from "react";
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Pottery Coach screen failed", error.name, info.componentStack); }
  render() { return this.state.failed ? <section className="notice"><h1>This part paused safely.</h1><p>Your camera and microphone have not been restarted. Reload when you are ready.</p></section> : this.props.children; }
}
