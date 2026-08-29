import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { prompts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// DELETE /api/prompts/cleanup — expire cached prompts older than 7 days
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  await db
    .delete(prompts)
    .where(and(eq(prompts.userId, user.id), lt(prompts.createdAt, cutoff)));
  return NextResponse.json({ ok: true });
}
