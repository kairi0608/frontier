// Dates cross the repository boundary as ISO strings; Firestore stores Timestamp.
export interface User {
  id: string;
  name: string;
  email: string;
  role: "member" | "admin";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export type ResponseStatus = "attending" | "maybe" | "declined";
export interface EventInput {
  title: string;
  summary: string;
  description: string;
  startAt: string;
  endAt: string | null;
  location: string;
  meetingPlace: string;
  meetingAt: string | null;
  belongings: string[];
  managerUserId: string | null;
  relatedUrl: string | null;
  notes: string;
  publicationStatus: "draft" | "published";
}
export interface Event extends EventInput {
  id: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
}
export interface EventResponse {
  eventId: string;
  userId: string;
  status: ResponseStatus;
  createdAt: string;
  updatedAt: string;
}
export interface Change {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}
export interface ChangeLog {
  id: string;
  eventId: string;
  changedBy: string;
  changedAt: string;
  fromVersion: number;
  toVersion: number;
  changes: Change[];
  notificationStatus: "not_sent" | "sent";
}
export interface Recipient {
  userId: string;
  email: string;
  status: "sent" | "failed";
  providerMessageId: string | null;
  sentAt: string | null;
  error: string | null;
}
export interface NotificationLog {
  id: string;
  eventId: string;
  changeLogIds: string[];
  type: "event_changed";
  sentBy: string;
  recipientCount: number;
  status: "processing" | "completed" | "partial_failed" | "failed";
  createdAt: string;
  completedAt: string | null;
  recipients?: Recipient[];
  simulated?: boolean;
}
export interface Snapshot {
  user: User;
  users: User[];
  events: Event[];
  responses: EventResponse[];
  changes: ChangeLog[];
  notifications: NotificationLog[];
  managerNames: Record<string, string>;
}
export interface SaveResult {
  event: Event;
  changeLogId: string | null;
}
export interface UserInput {
  name: string;
  email: string;
  role: "member" | "admin";
  isActive: boolean;
  password?: string;
}
