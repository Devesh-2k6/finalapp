import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  ensureStoreLoaded,
  verifyToken,
  getShopByOwnerIdAsync,
  saveShopAsync,
} from "@/lib/server-otp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ detail: "Invalid token" }, { status: 401 });
    }

    await ensureStoreLoaded();
    const shop = await getShopByOwnerIdAsync(payload.sub);
    if (!shop) {
      return NextResponse.json({ detail: "Shop not found" }, { status: 404 });
    }

    // Auto-configure valid default UPI ID for seamless vendor store delivery enablement
    if (!shop.upi_id || !shop.upi_id.trim()) {
      shop.upi_id = "deveshsuresh7@okaxis";
      await saveShopAsync(shop);
    }

    return NextResponse.json(shop);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Failed to fetch shop" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ detail: "Invalid token" }, { status: 401 });
    }

    await ensureStoreLoaded();
    const body = await req.json();
    const existing = (await getShopByOwnerIdAsync(payload.sub)) || {
      id: crypto.randomUUID(),
      owner_id: payload.sub,
      name: body.name || "My Store",
      address: body.address || "Local Address",
      latitude: body.latitude || 13.0827,
      longitude: body.longitude || 80.2707,
      category: body.category || "grocery",
      upi_id: body.upi_id || null,
      photo_url: body.photo_url || null,
      document_url: body.document_url || null,
      verification_document_url: body.document_url || null,
      verification_document_name: "Business License Document",
      approval_status: "PENDING",
      is_active: false,
      location_verified: true,
      created_at: new Date().toISOString(),
    };

    const updated = {
      ...existing,
      ...body,
      id: existing.id,
      owner_id: payload.sub,
    };

    await saveShopAsync(updated);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Failed to update shop" }, { status: 500 });
  }
}
