import { NextResponse } from "next/server";
import { ensureStoreLoaded, verifyToken } from "@/lib/server-otp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const store = await ensureStoreLoaded();
    let userId = "guest_user";
    if (token) {
      const payload = verifyToken(token);
      if (payload?.sub) userId = payload.sub;
    }

    const userFavs = (store.favorites || []).filter(
      (f: any) => f.user_id === userId || userId === "guest_user"
    );

    return NextResponse.json(userFavs);
  } catch {
    return NextResponse.json([]);
  }
}

