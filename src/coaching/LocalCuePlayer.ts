export type LocalCueManifest = { revision: number; approvedCues: Array<{ id: string; src: string; approvalId: string }> };

export class LocalCuePlayer {
  constructor(private readonly manifest: LocalCueManifest, private readonly playAudio: (src: string) => Promise<void>) {}
  async play(cueId: string): Promise<void> {
    const entry = this.manifest.approvedCues.find((cue) => cue.id === cueId && cue.approvalId.trim().length > 0);
    if (!entry) throw new Error(`Local cue ${cueId} is missing or unapproved`);
    await this.playAudio(entry.src);
  }
}
