import { NextResponse } from "next/server";
import {
  ensureStoreLoaded,
  getAllReservationsAsync,
  getShopByOwnerIdAsync,
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

    const shop = await getShopByOwnerIdAsync(payload.sub);
    if (!shop) {
      return NextResponse.json([]);
    }

    const reservations = await getAllReservationsAsync();
    const shopReservations = reservations.filter(
      (r) => r.shop_id === shop.id || r.product?.shop?.id === shop.id
    );
    return NextResponse.json(shopReservations);
  } catch (err: any) {
    return NextResponse.json([], { status: 200 });
  }
}
