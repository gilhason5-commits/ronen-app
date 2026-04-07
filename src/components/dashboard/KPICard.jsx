import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "../utils/formatNumbers";

export default function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp, 
  subtitle,
  color = "emerald",
  alert = false,
  currency = false
}) {
  const colorClasses = {
    emerald: "from-emerald-500 to-emerald-600 text-emerald-600",
    blue: "from-blue-500 to-blue-600 text-blue-600",
    purple: "from-purple-500 to-purple-600 text-purple-600",
    red: "from-red-500 to-red-600 text-red-600",
    green: "from-green-500 to-green-600 text-green-600"
  };

  const displayValue = currency && typeof value === 'number' ? fmtCurrency(value) : value;

  return (
    <Card className="relative overflow-hidden border-stone-200 hover:shadow-lg transition-shadow duration-300">
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8 rounded-full opacity-10",
        `bg-gradient-to-br ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]}`
      )} />
      <CardHeader className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-500 mb-2">{title}</p>
            <CardTitle className={cn(
              "text-3xl font-bold",
              alert ? "text-red-600" : "text-stone-900"
            )}>
              {displayValue}
            </CardTitle>
          </div>
          <div className={cn(
            "p-3 rounded-xl bg-opacity-10",
            `bg-gradient-to-br ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]}`
          )}>
            <Icon className={cn("w-5 h-5", colorClasses[color].split(' ')[2])} />
          </div>
        </div>
        {(trend || subtitle) && (
          <div className="flex items-center gap-2 mt-3">
            {trend && (
              <>
                {trendUp ? (
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  trendUp ? "text-red-600" : "text-green-600"
                )}>
                  {trend}
                </span>
              </>
            )}
            {subtitle && (
              <span className="text-sm text-stone-500">{subtitle}</span>
            )}
          </div>
        )}
      </CardHeader>
    </Card>
  );
}