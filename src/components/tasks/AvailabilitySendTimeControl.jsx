import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Check, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const HOURS = [];
for (let h = 0; h <= 23; h++) {
  for (let m = 0; m < 60; m += 30) {
    HOURS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function addTwoHours(hourStr) {
  const [h, m] = hourStr.split(":").map(Number);
  let newH = h + 2;
  if (newH >= 24) newH -= 24;
  return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function AvailabilitySendTimeControl() {
  const [currentHour, setCurrentHour] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.AppSetting.filter({ key: "availability_send_hour" })
      .then((settings) => {
        if (settings.length > 0) {
          setCurrentHour(settings[0].value);
          setSelectedHour(settings[0].value);
        } else {
          setCurrentHour("11:00");
          setSelectedHour("11:00");
        }
      })
      .catch(() => {
        setCurrentHour("11:00");
        setSelectedHour("11:00");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!selectedHour || selectedHour === currentHour) return;
    setSaving(true);
    try {
      const res = await fetch('/api/update-availability-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hour: selectedHour }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setCurrentHour(selectedHour);
      toast({
        title: "שעת השליחה עודכנה",
        description: `שליחת זמינות: ${selectedHour}, בדיקת אי-מענה: ${addTwoHours(selectedHour)}`,
      });
    } catch (err) {
      toast({
        title: "שגיאה",
        description: "לא הצלחנו לעדכן את שעת השליחה",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const hasChanged = selectedHour !== currentHour;

  return (
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-stone-500" />
      <span className="text-sm text-stone-600 hidden sm:inline">שליחת זמינות:</span>
      <Select value={selectedHour || ""} onValueChange={setSelectedHour}>
        <SelectTrigger className="w-[100px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasChanged && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}