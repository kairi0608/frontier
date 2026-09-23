import { NextResponse } from "next/server";
import { getAppMode } from "@/lib/config/app-mode";
import { ConfigurationError } from "@/lib/config/error";
import { z, ZodError } from "zod";
import { authorize, verifyIdentity } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import {
  eventSchema,
  idSchema,
  registrationSchema,
  userSchema,
} from "@/lib/events/validators";
import {
  getSnapshot,
  registerSelf,
  removeEvent,
  respond,
  saveEvent,
  saveUser,
} from "@/lib/repositories/firestore/server";
import { sendNotification } from "@/lib/notifications/send";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    if (getAppMode() === "prototype") {
      throw new AppError("試用モードでは本番APIを使用しません。", 404);
    }

    const { path } = await context.params;
    const [scope, resource, id, action] = path;
    const method = request.method;

    if (Number(request.headers.get("content-length")) > 100000) {
      throw new AppError("入力内容が大きすぎます。", 413);
    }

    if (scope === "auth" && resource === "register" && path.length === 2) {
      if (method !== "POST") {
        throw new AppError("ページが見つかりません。", 404);
      }

      let body: unknown;

      try {
        body = await request.json();
      } catch {
        throw new AppError("送信データを確認してください。");
      }

      const identity = await verifyIdentity(request);

      if (!identity.email) {
        throw new AppError("メールアドレスを確認できません。", 400);
      }

      const parsed = registrationSchema.parse(body);

      await registerSelf(identity.uid, identity.email, parsed.name);

      return NextResponse.json(
        { ok: true, status: "pending" },
        { status: 201 },
      );
    }

    const user = await authorize(request, scope === "admin");

    if (method === "GET" && path.join("/") === "data") {
      return NextResponse.json(await getSnapshot(user), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new AppError("送信データを確認してください。");
    }

    if (
      scope === "events" &&
      id === "response" &&
      path.length === 3 &&
      method === "PUT"
    ) {
      const parsed = z
        .object({
          status: z.enum(["attending", "maybe", "declined"]),
        })
        .strict()
        .parse(body);

      await respond(user, idSchema.parse(resource), parsed.status);

      return NextResponse.json({ ok: true });
    }

    if (scope === "admin" && resource === "events") {
      if (id) {
        idSchema.parse(id);
      }

      if (action === "notify" && path.length === 4 && method === "POST") {
        const parsed = z
          .object({
            changeLogId: idSchema,
            notificationRequestId: idSchema,
          })
          .strict()
          .parse(body);

        if (parsed.changeLogId !== parsed.notificationRequestId) {
          throw new AppError("通知要求IDが一致しません。");
        }

        return NextResponse.json(
          await sendNotification(user, id, parsed.changeLogId),
        );
      }

      if (
        !action &&
        ((method === "POST" && !id) || (method === "PUT" && id))
      ) {
        const parsed = z
          .object({
            input: eventSchema,
            version: z.number().int().positive().optional(),
          })
          .strict()
          .parse(body);

        return NextResponse.json(
          await saveEvent(user, parsed.input, id, parsed.version),
        );
      }

      if (!action && id && method === "DELETE") {
        const { version } = z
          .object({
            version: z.number().int().positive(),
          })
          .strict()
          .parse(body);

        await removeEvent(user, id, version);

        return NextResponse.json({ ok: true });
      }
    }

    if (
      scope === "admin" &&
      resource === "users" &&
      !action &&
      ((method === "POST" && !id) || (method === "PUT" && id))
    ) {
      if (id) {
        idSchema.parse(id);
      }

      await saveUser(user, userSchema.parse(body), id);

      return NextResponse.json({ ok: true });
    }

    throw new AppError("ページが見つかりません。", 404);
  } catch (error) {
    const status =
      error instanceof ConfigurationError
        ? 503
        : error instanceof AppError
          ? error.status
          : error instanceof ZodError
            ? 400
            : 500;

    const message =
      error instanceof AppError || error instanceof ConfigurationError
        ? error.message
        : error instanceof ZodError
          ? `入力内容を確認してください。${error.issues[0]?.message || ""}`
          : "サーバー処理に失敗しました。接続設定を確認して再試行してください。";

    if (status === 500) {
      console.error("Frontier API failure", error);
    }

    return NextResponse.json(
      { error: message },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as DELETE,
};
