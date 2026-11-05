import { NextResponse } from "next/server";
import { ensureStoreLoaded, verifyToken } from "@/lib/server-otp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const store = await ensureStoreLoaded();
    let userId = "";
    if (token) {
      const payload = verifyToken(token);
      if (payload?.sub) userId = payload.sub;
    }

    const followers = (store.followers || []).filter(
      (f: any) => !userId || f.user_id === userId
    );

    return NextResponse.json(followers);
  } catch {
    return NextResponse.json([]);
  }
}

