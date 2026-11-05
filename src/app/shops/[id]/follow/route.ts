import { NextResponse } from "next/server";
import crypto from "crypto";
import { ensureStoreLoaded, verifyToken, saveStoreAsync, getShopByIdAsync } from "@/lib/server-otp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shopId } = await params;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    let userId = "demo_user";
    if (token) {
      const payload = verifyToken(token);
      if (payload?.sub) userId = payload.sub;
    }

    const store = await ensureStoreLoaded();
    if (!Array.isArray(store.followers)) {
      store.followers = [];
    }

    const shop = await getShopByIdAsync(shopId);

    const follower = {
      id: crypto.randomUUID(),
      user_id: userId,
      shop_id: shopId,
      shop_name: shop?.name || "Local Store",
      created_at: new Date().toISOString(),
    };

    store.followers.push(follower);
    await saveStoreAsync(store);

    return NextResponse.json(follower);
  } catch {
    return NextResponse.json({ success: true });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shopId } = await params;
    const store = await ensureStoreLoaded();
    if (Array.isArray(store.followers)) {
      store.followers = store.followers.filter((f: any) => f.shop_id !== shopId);
      await saveStoreAsync(store);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}

