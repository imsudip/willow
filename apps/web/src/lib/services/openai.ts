import OpenAI from "openai";
import { env } from "../env";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY || "sk-placeholder" });

export function aiAvailable() {
  return Boolean(env.OPENAI_API_KEY && !env.OPENAI_API_KEY.startsWith("sk-placeholder"));
}
