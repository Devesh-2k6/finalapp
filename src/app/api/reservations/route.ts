import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  ensureStoreLoaded,
  getAllProductsAsync,
  getAllShopsAsync,
  getAllReservationsAsync,
  addReservationAsync,
  getUserByIdAsync,
  verifyToken,
  saveStoreAsync,
} from "@/lib/server-otp";
import { normalizeProduct } from "@/lib/products/normalize";

export async function GET(req: Request) {
  try {
    await ensureStoreLoaded();
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get("shop_id");
    const userId = searchParams.get("user_id");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let authUser: { sub: string; role: string } | null = null;
    if (token) {
      authUser = verifyToken(token);
    }

    let reservations = await getAllReservationsAsync();
    if (shopId) {
      reservations = reservations.filter((r) => r.shop_id === shopId || r.product?.shop?.id === shopId);
    }
    if (userId) {
      const cleanUid = userId.toLowerCase();
      reservations = reservations.filter(
        (r) =>
          (r.user_id || "").toLowerCase() === cleanUid ||
          ((r as any).customer_email || "").toLowerCase() === cleanUid
      );
    } else if (!shopId) {
      // Neither shop_id nor user_id provided: check auth role
      if (authUser && authUser.role === "ADMIN") {
        // Admin can view all reservations
      } else if (authUser) {
        // Standard user only sees their own
        const cleanSub = authUser.sub.toLowerCase();
        reservations = reservations.filter(
          (r) =>
            (r.user_id || "").toLowerCase() === cleanSub ||
            ((r as any).customer_email || "").toLowerCase() === cleanSub
        );
      } else {
        // Anonymous request without filters should never leak customer data
        return NextResponse.json([]);
      }
    }
    return NextResponse.json(reservations);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Failed to list reservations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureStoreLoaded();
    const body = await req.json();
    const productId = body.product_id;
    const quantity = Math.max(1, Number(body.quantity) || 1);

    if (!productId) {
      return NextResponse.json({ detail: "Product ID is required" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let userId = body.user_id || body.customer_id;
    let userEmail: string | undefined = undefined;
    let userName: string | undefined = undefined;

    if (token) {
      const payload = verifyToken(token);
      if (payload?.sub) {
        userId = payload.sub;
        const user = await getUserByIdAsync(payload.sub);
        if (user) {
          userId = user.id;
          userEmail = user.email;
          userName = user.name;
        }
      }
    }

    if (!userId) {
      userId = "guest_" + Date.now();
    }

    const products = await getAllProductsAsync();
    const shops = await getAllShopsAsync();
    let product = products.find((p) => p.id === productId);

    if (!product) {
      const fallbackShop = shops[0];
      product = normalizeProduct(
        {
          id: productId,
          name: body.product_name || "Surplus Deal Item",
          original_price: Number(body.price) || 50,
          discount_price: Number(body.price) || 40,
          quantity: 10,
        },
        fallbackShop
      );
    } else {
      const shop = shops.find((s) => s.id === product.shop_id) || product.shop || shops[0];
      product = normalizeProduct(product, shop);
    }

    const unitPrice =
      product.current_price ?? product.discount_price ?? product.original_price ?? 0;
    const totalPrice = unitPrice * quantity;

    // Decrement stock
    product.quantity = Math.max(0, (product.quantity || 1) - quantity);

    // 6-digit pickup code
    const pickupCode = String(crypto.randomInt(100000, 999999));

    const reservation = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      customer_email: userEmail,
      customer_name: userName || body.customer_name,
      shop_id: product.shop?.id || product.shop_id || "shop_nithiya_001",
      product_id: product.id,
      quantity,
      total_price: totalPrice,
      status: "PENDING",
      payment_status: "UNPAID",
      pickup_code: pickupCode,
      created_at: new Date().toISOString(),
      product,
    };

    await addReservationAsync(reservation);

    return NextResponse.json(reservation, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to create reservation" },
      { status: 500 }
    );
  }
}

