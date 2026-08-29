import { NextResponse } from "next/server";
import { userConfigUpdateSchema, type UserConfig } from "@willow/shared";
import { getSessionUser } from "@/lib/auth-helpers";
import { getConfig, updateConfig } from "@/lib/user-config";

export const dynamic = "force-dynamic";

// GET /api/user/config — the user's server-side settings (never the key)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await getConfig(user.id);
  return NextResponse.json(config satisfies UserConfig);
}

// PATCH /api/user/config — partial update of the settings JSON
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = userConfigUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid config", details: parsed.error.flatten() }, { status: 400 });

  const config = await updateConfig(user.id, parsed.data);
  return NextResponse.json(config satisfies UserConfig);
}
