import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth-helpers";
import { subscribe, unsubscribe } from "@/lib/services/push";

export const dynamic = "force-dynamic";

const pushSubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// POST /api/push/subscribe
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = pushSubSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  await subscribe(user.id, parsed.data);
  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint)
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  await unsubscribe(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
