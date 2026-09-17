import type {
  EventInput,
  NotificationLog,
  ResponseStatus,
  SaveResult,
  Snapshot,
  UserInput,
} from "@/types/domain";
export interface Repository {
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  snapshot(): Promise<Snapshot>;
  respond(eventId: string, status: ResponseStatus): Promise<void>;
  save(input: EventInput, id?: string, version?: number): Promise<SaveResult>;
  remove(id: string, version: number): Promise<void>;
  notify(id: string, changeLogId: string): Promise<NotificationLog>;
  saveUser(input: UserInput, id?: string): Promise<void>;
}
