import React from "react";

// Shown next to every amount on the reports page: costs and revenue there
// are all pre-VAT (revenue is entered incl. VAT and converted).
export default function ExVatTag({ className = "" }) {
  return <span className={`text-[10px] font-normal text-stone-400 whitespace-nowrap ${className}`}>לפני מע״מ</span>;
}
