import { writeBoardVideo, writeWheelVideo } from "./boardVideo";

export default async function globalSetup(): Promise<void> {
  await Promise.all([writeBoardVideo(), writeWheelVideo()]);
}
