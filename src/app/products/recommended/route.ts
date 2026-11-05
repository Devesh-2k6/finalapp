import { NextResponse } from "next/server";
import { ensureStoreLoaded, getAllProductsAsync, getAllShopsAsync } from "@/lib/server-otp";
import { normalizeProduct } from "@/lib/products/normalize";
import { calculateAiForecast } from "@/lib/products/forecast";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    await ensureStoreLoaded();
    const rawProducts = await getAllProductsAsync();
    const shops = await getAllShopsAsync();

    const now = Date.now();

    // Score and rank all active products using the AI rescue model
    const scoredProducts = rawProducts
      .filter((p: any) => {
        if (!p || p.is_active === false) return false;
        if (p.expiry_date) {
          const expMs = new Date(p.expiry_date).getTime();
          if (expMs < now) return false;
        }
        return true;
      })
      .map((p: any) => {
        const orig = Number(p.original_price) || 100;
        const curr = Number(p.discount_price) || Math.round(orig * 0.7);
        const qty = Number(p.quantity) || 1;
        const discountPct = orig > 0 ? (orig - curr) / orig : 0.3;

        const ai = calculateAiForecast(orig, curr, qty, p.expiry_date);

        const expMs = p.expiry_date ? new Date(p.expiry_date).getTime() : now + 86400000 * 2;
        const daysLeft = Math.max(0.1, (expMs - now) / 86400000);

        // Algorithmic composite score: higher rescue urgency + high customer value
        const aiScore =
          ai.rescueProbability * 0.45 +
          discountPct * 40 +
          (daysLeft <= 1.5 ? 25 : daysLeft <= 3 ? 15 : 5);

        const shop = shops.find((s: any) => s.id === p.shop_id) || shops[0];
        const normalized = normalizeProduct(p, shop);

        return {
          product: normalized,
          aiScore,
        };
      });

    // Sort by AI score descending
    scoredProducts.sort((a, b) => b.aiScore - a.aiScore);

    const recommended = scoredProducts.map((sp) => sp.product);

    return NextResponse.json(recommended, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    return NextResponse.json([], { status: 200 });
  }
}

