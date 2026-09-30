export function FormMessage({ state }: { state: { status: "idle" | "ok" | "error"; message?: string } }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${state.status === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>
      {state.message}
    </p>
  );
}

export const inputClass = "w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200";
export const primaryButton = "rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60";
export const secondaryButton = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
export const dangerButton = "rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50";
