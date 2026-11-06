import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "via.placeholder.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "example.com" },
      { protocol: "https", hostname: "*.onrender.com" },
      { protocol: "https", hostname: "*.railway.app" },
      { protocol: "https", hostname: "*.up.railway.app" },
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/users/me",
        destination: "/users/me",
      },
      {
        source: "/reservations/me",
        destination: "/api/reservations/me",
      },
      {
        source: "/shops/reservations",
        destination: "/api/shops/reservations",
      },
      {
        source: "/reservations/:id/verify",
        destination: "/api/reservations/:id/verify",
      },
      {
        source: "/reservations/:id/checkout",
        destination: "/api/reservations/:id/checkout",
      },
      {
        source: "/reservations",
        destination: "/api/reservations",
      },
      {
        source: "/orders/me",
        destination: "/api/orders/me",
      },
      {
        source: "/shops/orders",
        destination: "/api/shops/orders",
      },
      {
        source: "/orders",
        destination: "/api/orders",
      },
      {
        source: "/orders/:id",
        destination: "/api/orders/:id",
      },
      {
        source: "/products/recipe-generator",
        destination: "/api/products/recipe-generator",
      },
      {
        source: "/pantry/smart-alerts",
        destination: "/api/pantry/smart-alerts",
      },
      {
        source: "/pantry/recipe-from-fridge",
        destination: "/api/pantry/recipe-from-fridge",
      },
    ];
  },
};

export default nextConfig;
