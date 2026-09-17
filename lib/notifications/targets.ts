import type { EventResponse, User } from "@/types/domain";
export function selectRecipients(
  eventId: string,
  responses: EventResponse[],
  users: User[],
) {
  const attending = new Set(
    responses
      .filter((r) => r.eventId === eventId && r.status === "attending")
      .map((r) => r.userId),
  );
  return users.filter((u) => u.isActive && attending.has(u.id));
}
