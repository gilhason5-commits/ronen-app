import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QTY_MODES } from "@/lib/plannedDishQty";

const toNum = (v) => (v === "" ? "" : parseFloat(v) || 0);

// How a dish's quantity per event is set: serving % of the guests, a fixed
// count per event, or N plates per X guests. Choosing a fixed / per-guests
// count replaces the serving % row. `value` is the dish (or form data),
// `onChange` receives a partial patch.
export default function DishQtyModeFields({ value, onChange, percentHint }) {
  const mode = value.qty_mode || "percent";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-lg">
        {Object.entries(QTY_MODES).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ qty_mode: key })}
            className={`text-xs px-2 py-1.5 rounded-md transition-colors ${
              mode === key ? "bg-white shadow-sm font-semibold text-stone-900" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "percent" && (
        <div>
          <Label>אחוז מנות לכלל האורחים *</Label>
          {percentHint && <p className="text-xs text-stone-500 mb-1">{percentHint}</p>}
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              value={value.serving_percentage ?? ""}
              onChange={(e) => onChange({ serving_percentage: parseFloat(e.target.value) || 0 })}
              placeholder="100"
              className="pl-8"
              required
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">%</span>
          </div>
        </div>
      )}

      {mode === "fixed" && (
        <div>
          <Label>כמות לכל אירוע *</Label>
          <p className="text-xs text-stone-500 mb-1">אותה כמות בכל אירוע, בלי קשר למספר האורחים (למשל 5 מנות טבעוניות)</p>
          <Input
            type="text"
            inputMode="decimal"
            value={value.fixed_event_qty ?? ""}
            onChange={(e) => onChange({ fixed_event_qty: toNum(e.target.value) })}
            placeholder="5"
            required
          />
        </div>
      )}

      {mode === "per_guests" && (
        <div>
          <Label>כמות לפי מספר אורחים *</Label>
          <p className="text-xs text-stone-500 mb-1">למשל 5 מנות לכל 100 אורחים ← 15 מנות לאירוע של 300</p>
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="text"
              inputMode="decimal"
              value={value.per_guests_qty ?? ""}
              onChange={(e) => onChange({ per_guests_qty: toNum(e.target.value) })}
              placeholder="5"
              className="w-20 text-center"
              required
            />
            <span className="text-stone-600 whitespace-nowrap">מנות לכל</span>
            <Input
              type="text"
              inputMode="decimal"
              value={value.per_guests_base ?? 100}
              onChange={(e) => onChange({ per_guests_base: toNum(e.target.value) })}
              placeholder="100"
              className="w-20 text-center"
              required
            />
            <span className="text-stone-600">אורחים</span>
          </div>
        </div>
      )}
    </div>
  );
}
