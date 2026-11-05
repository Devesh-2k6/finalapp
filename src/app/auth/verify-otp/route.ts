import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  ensureStoreLoaded,
  verifyOtpCodeAsync,
  getUserAsync,
  saveUserAsync,
  saveShopAsync,
  getShopByOwnerIdAsync,
  getAllShopsAsync,
  createToken,
  type StoredUser,
  type StoredShop,
} from "@/lib/server-otp";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier = (body.identifier || "").trim().toLowerCase();
    const otp = (body.otp || "").trim();
    const name = (body.name || "").trim();
    const role = (body.role || "").trim().toLowerCase();
    const isShopOwner = Boolean(body.is_shop_owner);

    if (!identifier || !otp) {
      return NextResponse.json(
        { detail: "Identifier and OTP code are required." },
        { status: 400 }
      );
    }

    await ensureStoreLoaded();

    const { valid, record } = await verifyOtpCodeAsync(identifier, otp);
    if (!valid) {
      return NextResponse.json(
        { detail: "Invalid or expired OTP code. Please request a new code." },
        { status: 400 }
      );
    }

    const intent = (body.intent || record?.intent || "login").trim().toLowerCase();
    let user = await getUserAsync(identifier);

    // ── 1. SIGN IN FLOW (Strict Security: No Account Creation, Strict Role Check) ──
    if (intent === "login") {
      if (!user) {
        return NextResponse.json(
          {
            detail: `No account found with email "${identifier}". Fake account creation is blocked during Sign In. Please sign up first.`,
          },
          { status: 404 }
        );
      }

      const isVendorAccount =
        user.role === "VENDOR" ||
        Boolean(user.is_shop_owner);
      const isAdminAccount = user.role === "ADMIN";

      // Role mismatch check:
      if (role === "vendor" || role === "shop_owner") {
        if (!isVendorAccount) {
          return NextResponse.json(
            {
              detail: `"${identifier}" is registered as a Customer, not a Vendor. Please sign in as a Customer, or register your store under Sign Up.`,
            },
            { status: 403 }
          );
        }
      }

      if (role === "customer") {
        if (isVendorAccount) {
          return NextResponse.json(
            {
              detail: `"${identifier}" is registered as a Vendor account. Please sign in as a Vendor to access your merchant portal.`,
            },
            { status: 403 }
          );
        }
        if (isAdminAccount) {
          return NextResponse.json(
            {
              detail: `"${identifier}" is an Admin account. Please sign in as Admin.`,
            },
            { status: 403 }
          );
        }
      }

      if (role === "admin" && !isAdminAccount) {
        return NextResponse.json(
          {
            detail: "This account does not have Admin privileges.",
          },
          { status: 403 }
        );
      }

      // Mark verified upon successful login
      user.email_verified = true;
      await saveUserAsync(user);

      const token = createToken(user.id, user.role);

      return NextResponse.json({
        access_token: token,
        token_type: "bearer",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_shop_owner: user.is_shop_owner,
          email_verified: true,
          phone_number: user.phone_number,
          total_money_saved: 0,
          total_items_saved: 0,
          co2_saved_kg: 0,
        },
      });
    }

    // ── 2. SIGN UP / REGISTRATION FLOW ONLY ──
    const isVendor = record?.is_vendor !== undefined ? record.is_vendor : isShopOwner;
    const finalName = record?.name || name || identifier.split("@")[0] || "User";

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email: identifier,
        name: finalName,
        role: isVendor ? "VENDOR" : "CUSTOMER",
        is_shop_owner: isVendor,
        email_verified: true,
        phone_number: record?.phone_number,
        password_hash: record?.hashed_password || record?.password,
        created_at: new Date().toISOString(),
      };
      await saveUserAsync(user);
    } else {
      user.email_verified = true;
      if (isVendor && !user.is_shop_owner) {
        user.is_shop_owner = true;
        user.role = "VENDOR";
      }
      if (record?.hashed_password || record?.password) {
        user.password_hash = record.hashed_password || record.password;
      }
      await saveUserAsync(user);
    }

    if (isVendor) {
      const allShops = await getAllShopsAsync();
      let existingShop =
        (await getShopByOwnerIdAsync(user.id)) ||
        (await getShopByOwnerIdAsync(`vendor_${identifier}`)) ||
        allShops.find((s) => s.owner_email === identifier);

      if (existingShop) {
        existingShop.owner_id = user.id;
        existingShop.owner_name = user.name;
        await saveShopAsync(existingShop);
      } else {
        const newShop: StoredShop = {
          id: crypto.randomUUID(),
          owner_id: user.id,
          name: record?.name || finalName,
          category: record?.category || "grocery",
          owner_name: user.name,
          owner_email: user.email,
          owner_phone: record?.phone_number || user.phone_number || "",
          phone_number: record?.phone_number || user.phone_number || "",
          address: record?.address || "Commercial Market Location",
          latitude: record?.latitude || 13.0827,
          longitude: record?.longitude || 80.2707,
          upi_id: record?.upi_id || `${user.email.split("@")[0]}@okaxis`,
          photo_url: record?.photo_url || null,
          document_url: record?.document_url || null,
          verification_document_url: record?.document_url || null,
          verification_document_name: "Business License Document",
          approval_status: "APPROVED",
          approval_reason: "Verified during automated onboarding",
          approved_at: new Date().toISOString(),
          approved_by: "system_auto_verify",
          rejected_at: null,
          is_active: true,
          location_verified: true,
          created_at: new Date().toISOString(),
        };
        await saveShopAsync(newShop);
      }
    }

    const token = createToken(user.id, user.role);

    return NextResponse.json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_shop_owner: user.is_shop_owner,
        email_verified: true,
        phone_number: user.phone_number,
        total_money_saved: 0,
        total_items_saved: 0,
        co2_saved_kg: 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to verify OTP." },
      { status: 500 }
    );
  }
}
