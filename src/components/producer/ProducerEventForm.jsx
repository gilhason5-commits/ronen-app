import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ProducerDishSelector from "./ProducerDishSelector";

export default function ProducerEventForm({ event, onClose }) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    event_name: event?.event_name || "",
    event_date: event?.event_date || "",
    event_time: event?.event_time || "",
    event_type: event?.event_type || "serving",
    guest_count: event?.guest_count || 0,
    children_count: event?.children_count || 0,
    vegan_count: event?.vegan_count || 0,
    glatt_count: event?.glatt_count || 0,
    kashrut_note: event?.kashrut_note || "",
    notes: event?.notes || "",
    status: "producer_draft",
    producer_approved: false,
    price_per_plate: event?.price_per_plate || 0
  });

  const [savedEvent, setSavedEvent] = useState(event || null);

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list("display_order"),
    initialData: []
  });

  const categories = allCategories.filter(c => c.event_type === formData.event_type);

  const { data: allDishes = [] } = useQuery({
    queryKey: ["dishes"],
    queryFn: () => base44.entities.Dish.list(),
    initialData: []
  });

  const dishes = allDishes.filter(d => d.event_type === formData.event_type && d.active !== false);

  const { data: eventDishes = [], refetch: refetchEventDishes } = useQuery({
    queryKey: ["producer_event_dishes", savedEvent?.id],
    queryFn: () => base44.entities.Events_Dish.filter({ event_id: savedEvent.id }),
    enabled: !!savedEvent?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const saveEventMutation = useMutation({
    mutationFn: async (data) => {
      if (savedEvent?.id) {
        return await base44.entities.Event.update(savedEvent.id, data);
      } else {
        return await base44.entities.Event.create(data);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["producer_events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (!savedEvent?.id) {
        setSavedEvent(result);
        toast.success("האירוע נוצר! כעת ניתן לבחור מנות");
      } else {
        toast.success("האירוע עודכן");
        onClose();
      }
    },
    onError: () => {
      toast.error("שגיאה בשמירת האירוע");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveEventMutation.mutate(formData);
  };

  const handleDishNoteChange = (edId, noteVal) => {
    // DishNoteEditor already saved to DB, refetch to get latest
    queryClient.invalidateQueries({ queryKey: ["producer_event_dishes", savedEvent?.id] });
  };

  const handleDishToggle = async (dish, categoryId, checked) => {
    if (!savedEvent?.id) {
      toast.error("שמור את האירוע תחילה");
      return;
    }

    if (checked) {
      await base44.entities.Events_Dish.create({
        event_id: savedEvent.id,
        stage_id: null,
        category_id: categoryId,
        dish_id: dish.id,
        dish_name: dish.name,
        planned_qty: 0,
        planned_cost: 0,
        unit: dish.base_unit
      });
    } else {
      const existing = eventDishes.find(ed => ed.dish_id === dish.id);
      if (existing?.id) {
        await base44.entities.Events_Dish.delete(existing.id);
      }
    }
    refetchEventDishes();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-stone-900">
            {savedEvent ? "עריכת אירוע" : "יצירת אירוע חדש"}
          </h1>
          <p className="text-stone-500 mt-1">הגדר פרטי אירוע ובחר מנות</p>
        </div>
      </div>

      <Card className="border-stone-200">
        <CardHeader className="border-b border-stone-200 p-5">
          <CardTitle className="text-lg">פרטי אירוע</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>שם האירוע *</Label>
                <Input
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>תאריך *</Label>
                <Input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>שעה</Label>
                <Select
                  value={formData.event_time || ""}
                  onValueChange={(v) => setFormData({ ...formData, event_time: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר שעה..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 48 }, (_, i) => {
                      const h = Math.floor(i / 2);
                      const m = i % 2 === 0 ? "00" : "30";
                      const t = `${h.toString().padStart(2, "0")}:${m}`;
                      return <SelectItem key={t} value={t}>{t}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>סוג אירוע *</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(v) => setFormData({ ...formData, event_type: v })}
                  disabled={!!savedEvent?.id}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serving">אירוע הגשה</SelectItem>
                    <SelectItem value="wedding">אירוע הפוכה</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>מספר סועדים *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formData.guest_count || ""}
                  onChange={(e) => setFormData({ ...formData, guest_count: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  required
                />
              </div>

              <div className="col-span-2 grid grid-cols-4 gap-4">
                <div>
                  <Label>ילדים</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.children_count || ""}
                    onChange={(e) => setFormData({ ...formData, children_count: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>טבעונים</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.vegan_count || ""}
                    onChange={(e) => setFormData({ ...formData, vegan_count: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>גלאט</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.glatt_count || ""}
                    onChange={(e) => setFormData({ ...formData, glatt_count: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>הערה גלאט</Label>
                  <Input
                    value={formData.kashrut_note || ""}
                    onChange={(e) => setFormData({ ...formData, kashrut_note: e.target.value })}
                    placeholder="סוג כשרות..."
                  />
                </div>
              </div>

              <div className="col-span-2">
                <Label>הערות</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              {savedEvent ? "עדכון אירוע" : "יצירת אירוע"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {savedEvent?.id ? (
        <ProducerDishSelector
          categories={categories}
          dishes={dishes}
          eventDishes={eventDishes}
          onDishToggle={handleDishToggle}
          onDishNoteChange={handleDishNoteChange}
        />
      ) : (
        <Card className="border-stone-200 bg-blue-50">
          <CardContent className="p-6">
            <p className="font-medium text-blue-900">שמור את האירוע תחילה כדי לבחור מנות</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}