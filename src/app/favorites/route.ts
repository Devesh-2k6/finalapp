import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  ensureStoreLoaded,
  verifyToken,
  saveStoreAsync,
  getAllProductsAsync,
  getAllShopsAsync,
} from "@/lib/server-otp";
import { normalizeProduct } from "@/lib/products/normalize";

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
  } catch (err: any) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    let userId = "demo_customer";
    if (token) {
      const payload = verifyToken(token);
      if (payload?.sub) userId = payload.sub;
    }

    const body = await req.json().catch(() => ({}));
    const productId = body.product_id;
    if (!productId) {
      return NextResponse.json({ detail: "Product ID is required" }, { status: 400 });
    }

    const store = await ensureStoreLoaded();
    if (!Array.isArray(store.favorites)) {
      store.favorites = [];
    }

    const products = await getAllProductsAsync();
    const shops = await getAllShopsAsync();
    const rawProd = products.find((p: any) => p.id === productId) || products[0];
    const shop = shops.find((s: any) => s.id === rawProd?.shop_id) || shops[0];
    const normalized = rawProd ? normalizeProduct(rawProd, shop) : null;

    // Check if already favorited
    const existing = store.favorites.find(
      (f: any) => f.user_id === userId && f.product_id === productId
    );

    if (existing) {
      return NextResponse.json(existing);
    }

    const newFav = {
      id: crypto.randomUUID(),
      user_id: userId,
      product_id: productId,
      created_at: new Date().toISOString(),
      product: normalized || {
        id: productId,
        name: "Surplus Deal",
        discount_price: 25,
        original_price: 50,
      },
    };

    store.favorites.unshift(newFav);
    await saveStoreAsync(store);

    return NextResponse.json(newFav, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        user_id: "demo_customer",
        product_id: "unknown",
        created_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}

