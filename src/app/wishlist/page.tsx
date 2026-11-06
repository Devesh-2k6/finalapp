"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ArrowLeft,
  Trash2,
  ShoppingBag,
  Sparkles,
  Flame,
  Search,
  SlidersHorizontal,
  Clock,
  Tag,
  CheckCircle,
  AlertCircle,
  Truck,
  Smartphone,
  X,
  CreditCard,
  QrCode,
  Store,
  Layers,
  ArrowRight,
  ShieldCheck,
  Package,
} from "lucide-react";
import { ShopperLayout } from "@/components/layout/ShopperLayout";
import { DealProductCard } from "@/components/products/DealProductCard";
import { buildDealProductCardProps } from "@/lib/products/map-deal-product";
import { useAuth } from "@/contexts/AuthenticationContext";
import { useToast, ConfirmModal } from "@/components/ui/Toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  getFavorites,
  removeFavorite,
  addFavorite,
} from "@/services/products";
import { createReservation } from "@/services/reservations";
import { createOrder, reportOrderPayment } from "@/services/orders";
import {
  getStoredFavoriteIds,
  getStoredSavedProducts,
  storeSavedProduct,
  removeStoredSavedProduct,
  clearAllStoredSavedProducts,
  syncSavedProductsWithFavorites,
  FAVORITES_CHANGED_EVENT,
} from "@/lib/favorites";
import { getStoredLocation, type CustomerLocation } from "@/lib/customer-location";
import type { ApiProduct, ProductCategory, ApiOrder } from "@/types/product";
import { QRCodeSVG } from "qrcode.react";

export default function WishlistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [savedProducts, setSavedProducts] = useState<ApiProduct[]>(() =>
    getStoredSavedProducts()
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(getStoredFavoriteIds())
  );
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // User location for distance display
  const [userLocation, setUserLocation] = useState<CustomerLocation | null>(null);

  // Checkout & Reservation modal states
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<ApiProduct | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderType, setOrderType] = useState<"PICKUP" | "DELIVERY">("DELIVERY");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryName, setDeliveryName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [createdDeliveryOrder, setCreatedDeliveryOrder] = useState<ApiOrder | null>(null);
  const [modalStep, setModalStep] = useState<"details" | "upi_payment" | "confirmed">("details");
  const [upiPaymentConfirmed, setUpiPaymentConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upi_qr" | "cod">("upi_qr");
  const [upiRefId, setUpiRefId] = useState("");

  // Sync user details when logged in
  useEffect(() => {
    if (user) {
      setDeliveryName(user.name || "");
      setDeliveryPhone(user.phone_number || "");
    }
  }, [user]);

  // Load user location
  useEffect(() => {
    const loc = getStoredLocation();
    if (loc) setUserLocation(loc);
  }, []);

  // Hydrate favorites from storage and backend API
  const reloadFavorites = useCallback(async () => {
    const localProds = getStoredSavedProducts();
    const localIds = getStoredFavoriteIds();
    setSavedProducts(localProds);
    setFavoriteIds(new Set(localIds));

    if (user) {
      setLoading(true);
      try {
        const favs = await getFavorites();
        if (Array.isArray(favs)) {
          const synced = syncSavedProductsWithFavorites(favs);
          setSavedProducts(synced);
          setFavoriteIds(new Set(getStoredFavoriteIds()));
        }
      } catch (err) {
        console.warn("Backend favorites fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    reloadFavorites();
  }, [reloadFavorites]);

  // Listen to cross-tab / cross-component favorite changes
  useEffect(() => {
    const handleEvent = () => {
      setSavedProducts(getStoredSavedProducts());
      setFavoriteIds(new Set(getStoredFavoriteIds()));
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleEvent);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, handleEvent);
  }, []);

  // Real-time synchronization
  useWebSocket(() => {
    reloadFavorites();
  });

  // Handle Remove / Toggle Favorite
  const handleToggleFavorite = async (
    id: string,
    isFav: boolean,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const removedProduct = savedProducts.find((p) => p.id === id);

    if (isFav) {
      removeStoredSavedProduct(id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSavedProducts((prev) => prev.filter((p) => p.id !== id));

      toast.info(
        "Removed from wishlist",
        removedProduct ? `"${removedProduct.name}" removed.` : "Item removed from wishlist."
      );

      try {
        await removeFavorite(id);
      } catch (err) {
        console.warn("API remove favorite error:", err);
      }
    } else {
      if (removedProduct) {
        storeSavedProduct(removedProduct);
      }
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      try {
        await addFavorite(id);
      } catch (err) {
        console.warn("API add favorite error:", err);
      }
    }
  };

  const handleClearAll = () => {
    clearAllStoredSavedProducts();
    setSavedProducts([]);
    setFavoriteIds(new Set());
    setShowClearConfirm(false);
    toast.success("Wishlist cleared", "All saved items have been removed.");
  };

  const handleTogglePlay = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setPlayingId((prev) => (prev === id ? null : id));
  };

  const handleReserve = (id: string) => {
    const prod = savedProducts.find((p) => p.id === id);
    if (!prod) return;
    setSelectedProductForOrder(prod);
    setOrderQuantity(1);
    setOrderType("DELIVERY");
    setModalStep("details");
    setUpiPaymentConfirmed(false);
    setUpiRefId("");
  };

  // Filter and search wishlist items
  const filteredProducts = useMemo(() => {
    return savedProducts.filter((product) => {
      // Must still be marked as favorite
      if (!favoriteIds.has(product.id)) return false;

      // Category filter
      if (activeCategory !== "ALL") {
        if (activeCategory === "EXPIRING_SOON") {
          const exp = new Date(product.expiry_date).getTime();
          const now = Date.now();
          const hoursLeft = (exp - now) / (1000 * 60 * 60);
          if (hoursLeft > 24) return false;
        } else if (product.category !== activeCategory) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = product.name?.toLowerCase().includes(q);
        const matchesShop = product.shop?.name?.toLowerCase().includes(q);
        const matchesCategory = product.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesShop && !matchesCategory) return false;
      }

      return true;
    });
  }, [savedProducts, favoriteIds, activeCategory, searchQuery]);

  // Statistics
  const totalSavedValue = useMemo(() => {
    return filteredProducts.reduce((sum, p) => {
      const diff = Math.max(0, (p.original_price || 0) - (p.discount_price || 0));
      return sum + diff;
    }, 0);
  }, [filteredProducts]);

  const expiringCount = useMemo(() => {
    const now = Date.now();
    return savedProducts.filter((p) => {
      if (!favoriteIds.has(p.id)) return false;
      const exp = new Date(p.expiry_date).getTime();
      return (exp - now) / (1000 * 60 * 60) <= 24;
    }).length;
  }, [savedProducts, favoriteIds]);

  // Handle Checkout / Reservation Confirmation
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForOrder) return;

    if (!user) {
      toast.error("Sign in required", "Please sign in to reserve or order items.");
      router.push("/auth?role=customer&tab=login");
      return;
    }

    if (orderType === "PICKUP") {
      setIsSubmittingOrder(true);
      try {
        await createReservation(selectedProductForOrder.id, orderQuantity);
        toast.success(
          "Deal Reserved!",
          `Reserved from ${selectedProductForOrder.shop?.name || "merchant"}. Check Cart & Pickups.`
        );
        setSelectedProductForOrder(null);
        router.push("/reservations");
      } catch (err: any) {
        toast.error("Reservation Failed", err?.message || "Could not complete reservation.");
      } finally {
        setIsSubmittingOrder(false);
      }
      return;
    }

    // Delivery mode
    if (!deliveryAddress.trim() || !deliveryPhone.trim()) {
      toast.error("Details Missing", "Please enter your delivery address and phone number.");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const deliveryFeeVal = selectedProductForOrder.shop?.delivery_fee ?? 35;
      const order = await createOrder({
        product_id: selectedProductForOrder.id,
        quantity: orderQuantity,
        order_type: "DELIVERY",
        delivery_fee: deliveryFeeVal,
        customer_name: deliveryName.trim(),
        customer_phone: deliveryPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        delivery_notes: orderNotes.trim() || undefined,
      });

      setCreatedDeliveryOrder(order);

      if (paymentMethod === "cod") {
        setModalStep("confirmed");
      } else {
        setModalStep("upi_payment");
      }
    } catch (err: any) {
      toast.error("Order Failed", err?.message || "Could not create delivery order.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleConfirmUpiPayment = async () => {
    if (!createdDeliveryOrder) return;
    setIsSubmittingOrder(true);
    try {
      await reportOrderPayment(
        createdDeliveryOrder.id,
        upiRefId.trim() || "UPI-" + Date.now().toString().slice(-6)
      );
      setUpiPaymentConfirmed(true);
      setModalStep("confirmed");
      toast.success("Payment Recorded", "Your order has been sent to the shop!");
    } catch (err: any) {
      toast.error("Payment confirmation failed", err?.message || "Please check details.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const categories = [
    { id: "ALL", label: `All Saved (${favoriteIds.size})` },
    ...(expiringCount > 0
      ? [{ id: "EXPIRING_SOON", label: `Expiring Soon ⚡ (${expiringCount})` }]
      : []),
    { id: "BAKERY", label: "Bakery & Breads" },
    { id: "DAIRY", label: "Dairy & Eggs" },
    { id: "PRODUCE", label: "Produce & Fruit" },
    { id: "PREPARED_FOOD", label: "Prepared Meals" },
    { id: "PANTRY", label: "Pantry Staples" },
    { id: "MEAT", label: "Meat & Poultry" },
  ];

  return (
    <ShopperLayout>
      <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#0B0F17] pb-24 transition-colors">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0F141F]/80 backdrop-blur-xl border-b border-zinc-200/70 dark:border-zinc-800/80 px-4 lg:px-8 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/deals"
                className="w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 transition"
                title="Back to Deals Feed"
              >
                <ArrowLeft size={16} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <Heart size={16} className="fill-rose-500" />
                  </div>
                  <h1 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                    My Wishlist & Saved Deals
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60">
                    {favoriteIds.size}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Keep tabs on discounted surplus products and claim them before they sell out.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {favoriteIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 text-xs font-semibold transition"
                >
                  <Trash2 size={13} />
                  <span>Clear All</span>
                </button>
              )}
              <Link
                href="/deals"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm shadow-purple-600/20"
              >
                <Flame size={13} />
                <span>Explore More Deals</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="w-full max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-6">
          {/* Guest User Sync Advisory */}
          {!user && favoriteIds.size > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
                    Wishlist saved on this device
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Sign in to sync your saved surplus deals across your phone, tablet, and browser!
                  </p>
                </div>
              </div>
              <Link
                href="/auth?role=customer&tab=login"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shrink-0"
              >
                Sign In to Sync
              </Link>
            </div>
          )}

          {/* Quick Metrics Bar (if items exist) */}
          {favoriteIds.size > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-[#0F141F] rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-4 shadow-xs">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold mb-1">
                  <Heart size={14} className="text-rose-500" />
                  <span>Saved Deals</span>
                </div>
                <p className="text-2xl font-black text-zinc-900 dark:text-white">
                  {favoriteIds.size}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Ready to reserve or order
                </p>
              </div>

              <div className="bg-white dark:bg-[#0F141F] rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-4 shadow-xs">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold mb-1">
                  <Tag size={14} className="text-emerald-500" />
                  <span>Total Savings Value</span>
                </div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{totalSavedValue.toFixed(0)}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Savings compared to retail price
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-white dark:bg-[#0F141F] rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-4 shadow-xs">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold mb-1">
                  <Clock size={14} className="text-amber-500" />
                  <span>Expiring Within 24h</span>
                </div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {expiringCount}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Claim before they expire
                </p>
              </div>
            </div>
          )}

          {/* Search & Category Filter Chips */}
          {favoriteIds.size > 0 && (
            <div className="space-y-3">
              <div className="relative bg-white dark:bg-[#0F141F] rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 flex items-center px-3.5 py-2.5 shadow-2xs">
                <Search size={15} className="text-zinc-400 mr-2.5 shrink-0" />
                <input
                  type="search"
                  placeholder="Filter saved deals by product or shop name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((cat) => {
                  const active = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                        active
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                          : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State: Wishlist is completely empty */}
          {favoriteIds.size === 0 && (
            <div className="py-20 text-center bg-white dark:bg-[#0F141F] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-8 shadow-xs max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center">
                <Heart size={32} className="fill-rose-500/20" />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                  Your wishlist is empty
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1 leading-relaxed">
                  Tap the ❤️ heart icon on any deal card in the feed to save it here for fast checkout before stock sells out!
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/deals"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-md shadow-purple-600/25 active:scale-95"
                >
                  <Flame size={15} />
                  <span>Browse Active Deals Feed</span>
                </Link>
              </div>
            </div>
          )}

          {/* Empty State: Filter matched 0 items */}
          {favoriteIds.size > 0 && filteredProducts.length === 0 && (
            <div className="py-14 text-center bg-white dark:bg-[#0F141F] border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-8 shadow-xs max-w-md mx-auto space-y-3">
              <Package size={36} className="mx-auto text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                No matching saved deals
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No wishlisted items match your current search or category filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("ALL");
                  setSearchQuery("");
                }}
                className="mt-2 text-xs font-bold text-purple-600 dark:text-purple-400 underline"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Products Grid */}
          {filteredProducts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Showing {filteredProducts.length} saved deal{filteredProducts.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                {filteredProducts.map((product, index) => (
                  <DealProductCard
                    key={product.id}
                    {...buildDealProductCardProps(
                      product,
                      index,
                      playingId,
                      handleTogglePlay,
                      handleReserve,
                      userLocation?.lat,
                      userLocation?.lng
                    )}
                    isFavorite={true}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Confirmation Modal for Clearing Wishlist */}
      <ConfirmModal
        open={showClearConfirm}
        options={{
          title: "Clear entire wishlist?",
          message:
            "Are you sure you want to remove all saved deals from your wishlist? You will need to save them again from the deals feed.",
          confirmLabel: "Yes, Clear All",
          cancelLabel: "Keep Items",
          danger: true,
        }}
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Checkout / Claim Surplus Deal Modal */}
      {selectedProductForOrder && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  {modalStep === "upi_payment" ? (
                    <Smartphone size={20} />
                  ) : orderType === "DELIVERY" ? (
                    <Truck size={20} />
                  ) : (
                    <ShoppingBag size={20} />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white leading-tight">
                    {modalStep === "upi_payment"
                      ? "UPI Direct Payment"
                      : modalStep === "confirmed"
                      ? "Deal Confirmed!"
                      : "Claim Wishlisted Deal"}
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {modalStep === "upi_payment"
                      ? "Scan QR or enter UPI Ref to confirm order"
                      : `From ${selectedProductForOrder.shop?.name || "Local Shop"}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProductForOrder(null);
                  setCreatedDeliveryOrder(null);
                  setModalStep("details");
                }}
                className="p-2 rounded-xl hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Step: Order Details Form */}
            {modalStep === "details" && (
              <form onSubmit={handleProceedToPayment} className="p-5 space-y-4">
                {/* Product Summary Row */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-3 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {selectedProductForOrder.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        ₹{selectedProductForOrder.discount_price}
                      </span>
                      <span className="line-through text-zinc-400 text-[11px]">
                        ₹{selectedProductForOrder.original_price}
                      </span>
                    </div>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2 py-1">
                    <button
                      type="button"
                      disabled={orderQuantity <= 1}
                      onClick={() => setOrderQuantity((q) => Math.max(1, q - 1))}
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 text-sm font-bold px-1"
                    >
                      -
                    </button>
                    <span className="text-xs font-black min-w-[16px] text-center">
                      {orderQuantity}
                    </span>
                    <button
                      type="button"
                      disabled={orderQuantity >= selectedProductForOrder.quantity}
                      onClick={() =>
                        setOrderQuantity((q) =>
                          Math.min(selectedProductForOrder.quantity, q + 1)
                        )
                      }
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 text-sm font-bold px-1"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Pickup vs Delivery Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOrderType("PICKUP")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                      orderType === "PICKUP"
                        ? "bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <ShoppingBag size={14} />
                    <span>Store Pickup (Free)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("DELIVERY")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                      orderType === "DELIVERY"
                        ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <Truck size={14} />
                    <span>Instant Delivery</span>
                  </button>
                </div>

                {/* Delivery Fields */}
                {orderType === "DELIVERY" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                        Full Delivery Address
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="House / Flat No., Street, Landmark, Area..."
                        className="mt-1 w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          required
                          value={deliveryPhone}
                          onChange={(e) => setDeliveryPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="mt-1 w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                          Contact Name
                        </label>
                        <input
                          type="text"
                          required
                          value={deliveryName}
                          onChange={(e) => setDeliveryName(e.target.value)}
                          placeholder="Your name"
                          className="mt-1 w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                        Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("upi_qr")}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                            paymentMethod === "upi_qr"
                              ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          <Smartphone size={16} />
                          <div>
                            <p className="text-xs font-bold leading-tight">Instant UPI QR</p>
                            <p className="text-[10px] opacity-70">GPay, PhonePe, Paytm</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cod")}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                            paymentMethod === "cod"
                              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          <CreditCard size={16} />
                          <div>
                            <p className="text-xs font-bold leading-tight">Pay on Delivery</p>
                            <p className="text-[10px] opacity-70">Cash or UPI upon delivery</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total Price breakdown */}
                <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-500">Total Due:</span>
                  <div className="text-right">
                    <span className="text-base font-black text-zinc-900 dark:text-white">
                      ₹{selectedProductForOrder.discount_price * orderQuantity}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold">
                      Saved ₹
                      {(selectedProductForOrder.original_price -
                        selectedProductForOrder.discount_price) *
                        orderQuantity}
                    </span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow-md shadow-purple-600/20 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingOrder ? (
                    <span>Processing Order...</span>
                  ) : orderType === "PICKUP" ? (
                    <>
                      <ShoppingBag size={14} />
                      <span>Confirm Counter Pickup Reservation</span>
                    </>
                  ) : paymentMethod === "upi_qr" ? (
                    <>
                      <Smartphone size={14} />
                      <span>Proceed to UPI Payment</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      <span>Place Pay-on-Delivery Order</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Modal Step: UPI Payment QR */}
            {modalStep === "upi_payment" && createdDeliveryOrder && (
              <div className="p-6 text-center space-y-4">
                <div className="bg-white p-4 rounded-2xl inline-block border-2 border-purple-500/30 shadow-lg">
                  <QRCodeSVG
                    value={`upi://pay?pa=expirygo@icici&pn=ExpiryGo&am=${createdDeliveryOrder.total_price}&cu=INR&tn=Order-${createdDeliveryOrder.id.slice(0, 8)}`}
                    size={160}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Total Amount
                  </p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">
                    ₹{createdDeliveryOrder.total_price}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)
                  </p>
                </div>

                <div className="text-left space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    UPI Transaction ID / Ref No (Optional)
                  </label>
                  <input
                    type="text"
                    value={upiRefId}
                    onChange={(e) => setUpiRefId(e.target.value)}
                    placeholder="e.g. 331489201923"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalStep("details")}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingOrder}
                    onClick={handleConfirmUpiPayment}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm"
                  >
                    {isSubmittingOrder ? "Verifying..." : "I Have Paid"}
                  </button>
                </div>
              </div>
            )}

            {/* Modal Step: Confirmed */}
            {modalStep === "confirmed" && (
              <div className="p-8 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white">
                    Order Placed Successfully!
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    The merchant is preparing your rescue package. You can track status in Cart & Pickups.
                  </p>
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductForOrder(null);
                      setModalStep("details");
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400"
                  >
                    Close
                  </button>
                  <Link
                    href="/reservations"
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <span>View In Cart</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ShopperLayout>
  );
}
