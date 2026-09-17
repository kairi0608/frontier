import { z } from "zod";
const timestamp = z.iso.datetime({ offset: true });
export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "イベント名を入力してください。").max(120),
    summary: z.string().max(300),
    description: z.string().max(10000),
    startAt: timestamp,
    endAt: timestamp.nullable(),
    location: z.string().trim().min(1, "開催場所を入力してください。").max(300),
    meetingPlace: z.string().max(300),
    meetingAt: timestamp.nullable(),
    belongings: z.array(z.string().max(100)).max(50),
    managerUserId: z.string().max(128).nullable(),
    relatedUrl: z
      .url()
      .refine(
        (v) => /^https?:\/\//i.test(v),
        "URLはhttp/httpsで入力してください。",
      )
      .nullable(),
    notes: z.string().max(5000),
    publicationStatus: z.enum(["draft", "published"]),
  })
  .strict()
  .refine(
    (e) => !e.endAt || new Date(e.endAt) >= new Date(e.startAt),
    "終了日時は開催日時以降にしてください。",
  );
export const userSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    role: z.enum(["member", "admin"]),
    isActive: z.boolean(),
    password: z.string().min(12).max(128).optional(),
  })
  .strict();
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
