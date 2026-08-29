import { NextResponse } from "next/server";
import { openaiKeyUpdateSchema } from "@willow/shared";
import { getSessionUser } from "@/lib/auth-helpers";
import { setOpenaiKey } from "@/lib/user-config";

export const dynamic = "force-dynamic";

/**
 * PUT /api/user/config/openai-key — set or clear the user's BYO OpenAI key.
 *
 * The key is encrypted at rest (AES-256-GCM with an app secret) and is never
 * returned by any endpoint — the client only learns whether one is set.
 */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = openaiKeyUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid apiKey" }, { status: 400 });

  const result = await setOpenaiKey(user.id, parsed.data.apiKey);
  return NextResponse.json(result);
}
