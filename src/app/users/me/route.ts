import { NextResponse } from "next/server";
import { ensureStoreLoaded, verifyToken, getUserByIdAsync, updateUserProfileAsync } from "@/lib/server-otp";

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
      return NextResponse.json({ detail: "Invalid or expired session token" }, { status: 401 });
    }

    await ensureStoreLoaded();
    const user = await getUserByIdAsync(payload.sub);
    if (!user) {
      if (payload.sub === "admin_devesh_001") {
        return NextResponse.json({
          id: "admin_devesh_001",
          email: "devpant2006@gmail.com",
          name: "Devesh Admin",
          role: "ADMIN",
          is_shop_owner: false,
          email_verified: true,
          total_money_saved: 0,
          total_items_saved: 0,
          co2_saved_kg: 0,
        });
      }
      return NextResponse.json({ detail: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_shop_owner: user.is_shop_owner,
      email_verified: user.email_verified,
      phone_number: user.phone_number,
      total_money_saved: (user as any).total_money_saved || 0,
      total_items_saved: (user as any).total_items_saved || 0,
      co2_saved_kg: (user as any).co2_saved_kg || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Failed to retrieve user" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ detail: "Invalid or expired session token" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const phone_number = typeof body.phone_number === "string" ? body.phone_number.trim() : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ detail: "Name cannot be empty" }, { status: 400 });
    }

    const updated = await updateUserProfileAsync(payload.sub, { name, phone_number });
    if (!updated) {
      return NextResponse.json({ detail: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      is_shop_owner: updated.is_shop_owner,
      email_verified: updated.email_verified,
      phone_number: updated.phone_number,
      total_money_saved: (updated as any).total_money_saved || 0,
      total_items_saved: (updated as any).total_items_saved || 0,
      co2_saved_kg: (updated as any).co2_saved_kg || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Failed to update profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return PATCH(req);
}
