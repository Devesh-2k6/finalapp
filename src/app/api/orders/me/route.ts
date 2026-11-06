import { NextResponse } from "next/server";
import {
  ensureStoreLoaded,
  getAllOrdersAsync,
  getUserByIdAsync,
  verifyToken,
} from "@/lib/server-otp";

export async function GET(req: Request) {
  try {
    await ensureStoreLoaded();
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json([]);
    }

    const payload = verifyToken(token);
    if (!payload?.sub) {
      return NextResponse.json([]);
    }

    const user = await getUserByIdAsync(payload.sub);
    const userId = (user?.id || payload.sub).toLowerCase();
    const userEmail = user?.email?.toLowerCase();

    const orders = await getAllOrdersAsync();
    const filtered = orders.filter((o) => {
      const oCustId = (o.customer_id || "").toLowerCase();
      const oCustEmail = ((o as any).customer_email || "").toLowerCase();
      return (
        oCustId === userId ||
        (userEmail && (oCustId === userEmail || oCustEmail === userEmail))
      );
    });

    return NextResponse.json(filtered);
  } catch (err: any) {
    return NextResponse.json([], { status: 200 });
  }
}
