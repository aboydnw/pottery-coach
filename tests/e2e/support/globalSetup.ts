import { writeBoardVideo } from "./boardVideo";

export default async function globalSetup(): Promise<void> {
  await writeBoardVideo();
}
