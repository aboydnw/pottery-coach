export type CameraSettings = Pick<
  MediaTrackSettings,
  "deviceId" | "facingMode" | "width" | "height" | "frameRate"
>;

export type CameraEventType =
  | "started"
  | "settings"
  | "muted"
  | "unmuted"
  | "ended"
  | "interrupted"
  | "error";

export type CameraEvent = {
  type: CameraEventType;
  timestamp: number;
  reason?: string;
  settings?: CameraSettings;
  error?: unknown;
};

export type CameraStartResult = {
  stream: MediaStream;
  settings: CameraSettings;
};
