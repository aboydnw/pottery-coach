import type { SessionRepository } from "../session/SessionRepository";
export class RetentionService {
  constructor(private repository: SessionRepository) {}
  async expire(now = Date.now(), retentionMs = 30 * 86_400_000) {
    const sessions = await this.repository.list();
    const expired = sessions.filter((session) => session.endedAtMs !== null && now - session.startedAtMs >= retentionMs);
    await Promise.all(expired.map((session) => this.repository.delete(session.id)));
    return expired.map((session) => session.id);
  }
}
