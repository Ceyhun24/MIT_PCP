"use client";
import dynamic from "next/dynamic";

export const PinMapLazy = dynamic(() => import("@/components/PinMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});
