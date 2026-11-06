import { NextResponse } from "next/server";
import {
  ensureStoreLoaded,
  getAllReservationsAsync,
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

    const reservations = await getAllReservationsAsync();
    const filtered = reservations.filter((r) => {
      const rUserId = (r.user_id || "").toLowerCase();
      const rCustomerEmail = ((r as any).customer_email || "").toLowerCase();
      return (
        rUserId === userId ||
        (userEmail && (rUserId === userEmail || rCustomerEmail === userEmail))
      );
    });

    return NextResponse.json(filtered);
  } catch (err: any) {
    return NextResponse.json([], { status: 200 });
  }
}
