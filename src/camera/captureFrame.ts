/** Copies the video's current frame at full resolution. */
export function captureFrame(video: HTMLVideoElement): ImageData {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("The camera has not delivered a frame yet.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas capture is unavailable.");
  context.drawImage(video, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}
