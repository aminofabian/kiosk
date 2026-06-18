"use client";

import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";

export function OpenPosCard() {
  return (
    <section className="w-full">
      <Link href="/pos">
        <div
          className="group relative w-full overflow-hidden rounded-xl sm:rounded-2xl bg-[#1c6a1e] bg-gradient-to-r from-[#1c6a1e] to-[#1fa87a] px-4 py-3 sm:px-6 sm:py-5 transition-all duration-200 hover:shadow-xl hover:shadow-[#1c6a1e]/25 active:scale-[0.99] cursor-pointer"
          style={{ backgroundColor: "#1c6a1e" }}
        >
          <div
            className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/[0.06]"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          />
          <div
            className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/[0.04]"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ring-1 ring-white/20 bg-white/15 backdrop-blur-sm"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <ShoppingCart
                className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                style={{ color: "#ffffff" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className="text-sm sm:text-lg font-bold text-white leading-tight"
                style={{ color: "#ffffff" }}
              >
                Open POS
              </h2>
              <p
                className="text-[11px] sm:text-sm text-white/70 mt-0.5 leading-tight"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                Start selling and processing transactions
              </p>
            </div>
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors flex-shrink-0 bg-white/10"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <ArrowRight
                className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 group-hover:translate-x-0.5 transition-transform"
                style={{ color: "rgba(255,255,255,0.9)" }}
              />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
