import { NextResponse } from "next/server";
import { ensureStoreLoaded, verifyToken, saveStoreAsync } from "@/lib/server-otp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const store = await ensureStoreLoaded();
    let userId = "";
    if (token) {
      const payload = verifyToken(token);
      if (payload?.sub) userId = payload.sub;
    }

    if (Array.isArray(store.favorites)) {
      store.favorites = store.favorites.filter(
        (f: any) =>
          !(
            (f.product_id === id || f.id === id) &&
            (!userId || f.user_id === userId)
          )
      );
      await saveStoreAsync(store);
    }

    return NextResponse.json({ success: true, removed_id: id });
  } catch (err: any) {
    return NextResponse.json({ success: true });
  }
}

