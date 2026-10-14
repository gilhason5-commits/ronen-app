import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const toNum = (v) => (v === "" ? "" : parseFloat(v) || 0);

// How a dish's quantity per event is set: a switch between serving % of the
// guests and a fixed count per event. Both fields stay visible; the one the
// switch points at is editable, the other is greyed out and locked.
// (The "per_guests" mode is still honoured in the calculations but is no
// longer offered here.) `value` is the dish (or form data), `onChange`
// receives a partial patch.
export default function DishQtyModeFields({ value, onChange, percentHint }) {
  const isFixed = (value.qty_mode || "percent") === "fixed";
  const lockedClass = "disabled:opacity-100 disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-3 text-sm">
        <button type="button" onClick={() => onChange({ qty_mode: "percent" })} className={!isFixed ? "font-semibold text-stone-900" : "text-stone-500"}>
          אחוז הגשה
        </button>
        <Switch
          checked={isFixed}
          onCheckedChange={(checked) => onChange({ qty_mode: checked ? "fixed" : "percent" })}
          className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-emerald-600"
        />
        <button type="button" onClick={() => onChange({ qty_mode: "fixed" })} className={isFixed ? "font-semibold text-stone-900" : "text-stone-500"}>
          כמות קבועה
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={isFixed ? "text-stone-400" : ""}>אחוז מנות לכלל האורחים {!isFixed && "*"}</Label>
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              value={value.serving_percentage ?? ""}
              onChange={(e) => onChange({ serving_percentage: parseFloat(e.target.value) || 0 })}
              placeholder="100"
              className={`pl-8 ${lockedClass}`}
              disabled={isFixed}
              required={!isFixed}
            />
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${isFixed ? "text-stone-300" : "text-stone-500"}`}>%</span>
          </div>
        </div>
        <div>
          <Label className={!isFixed ? "text-stone-400" : ""}>כמות לכל אירוע {isFixed && "*"}</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={value.fixed_event_qty ?? ""}
            onChange={(e) => onChange({ fixed_event_qty: toNum(e.target.value) })}
            placeholder="5"
            className={lockedClass}
            disabled={!isFixed}
            required={isFixed}
          />
        </div>
      </div>
      <p className="text-xs text-stone-500">
        {isFixed ? "אותה כמות בכל אירוע, בלי קשר למספר האורחים" : percentHint || "הכמות לאירוע מחושבת לפי אחוז מכמות הסועדים"}
      </p>
    </div>
  );
}
