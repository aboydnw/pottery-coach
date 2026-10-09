import type { SessionRepository } from "../session/SessionRepository";
export class RetentionService {
  constructor(private repository: SessionRepository) {}
  async expire(now = Date.now(), retentionMs = 30 * 86_400_000) {
    return this.repository.expire(now, retentionMs);
  }
}
