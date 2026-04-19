import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function EventDialog({ event, dishes, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    event_date: '',
    event_time: '',
    guests: 0,
    service_style: 'buffet',
    menu_types: [],
    selected_dishes: [],
    base_price: 0,
    price_per_guest: 0,
    extras_discounts: 0,
    notes: '',
    status: 'draft'
  });

  useEffect(() => {
    if (event) {
      setFormData(event);
    }
  }, [event]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const calculatedData = calculateEventFinancials(data);
      if (event?.id) {
        return base44.entities.Event.update(event.id, calculatedData);
      } else {
        return base44.entities.Event.create(calculatedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(event ? 'Event updated successfully' : 'Event created successfully');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to save event');
      console.error(error);
    }
  });

  const calculateEventFinancials = (data) => {
    let food_cost = 0;
    const selected_dishes = data.selected_dishes || [];
    
    selected_dishes.forEach(dish => {
      food_cost += (dish.total_cost || 0);
    });

    const event_price = (data.base_price || 0) + 
                       ((data.price_per_guest || 0) * (data.guests || 0)) + 
                       (data.extras_discounts || 0);

    const margin_pct = event_price > 0 ? ((event_price - food_cost) / event_price) * 100 : 0;

    return {
      ...data,
      food_cost,
      event_price,
      margin_pct
    };
  };

  const handleDishToggle = (dish) => {
    const isSelected = formData.selected_dishes?.some(d => d.dish_id === dish.id);
    let newSelectedDishes;
    
    if (isSelected) {
      newSelectedDishes = formData.selected_dishes.filter(d => d.dish_id !== dish.id);
    } else {
      const quantity = Math.ceil(formData.guests / 10) || 1;
      const total_cost = (dish.unit_cost || 0) * quantity;
      
      newSelectedDishes = [
        ...(formData.selected_dishes || []),
        {
          dish_id: dish.id,
          dish_name: dish.name,
          quantity: quantity,
          unit_cost: dish.unit_cost || 0,
          total_cost: total_cost
        }
      ];
    }
    
    setFormData({ ...formData, selected_dishes: newSelectedDishes });
  };

  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    const errors = [];
    if (!formData.event_name?.trim()) errors.push('שם אירוע');
    if (!formData.event_date) errors.push('תאריך');
    if (errors.length > 0) {
      setValidationError('שדות חובה חסרים: ' + errors.join(', '));
      return;
    }
    setValidationError('');
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create New Event'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Event Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({...formData, event_date: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={formData.event_time}
                onChange={(e) => setFormData({...formData, event_time: e.target.value})}
              />
            </div>

            <div>
              <Label>Number of Guests *</Label>
              <Input
                type="number"
                value={formData.guests}
                onChange={(e) => setFormData({...formData, guests: parseInt(e.target.value) || 0})}
                required
              />
            </div>

            <div>
              <Label>Service Style *</Label>
              <Select
                value={formData.service_style}
                onValueChange={(value) => setFormData({...formData, service_style: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buffet">Buffet</SelectItem>
                  <SelectItem value="plated">Plated</SelectItem>
                  <SelectItem value="family_style">Family Style</SelectItem>
                  <SelectItem value="cocktail">Cocktail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Select Dishes</Label>
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
              {dishes.filter(d => d.active).map(dish => (
                <div key={dish.id} className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded">
                  <Checkbox
                    checked={formData.selected_dishes?.some(d => d.dish_id === dish.id)}
                    onCheckedChange={() => handleDishToggle(dish)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{dish.name}</p>
                    <p className="text-xs text-stone-500">
                      ${(dish.unit_cost || 0).toFixed(2)} per unit
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Base Price</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData({...formData, base_price: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <Label>Price per Guest</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_per_guest}
                onChange={(e) => setFormData({...formData, price_per_guest: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <Label>Extras/Discounts</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.extras_discounts}
                onChange={(e) => setFormData({...formData, extras_discounts: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </div>

          {validationError && (
            <p className="text-sm text-red-600 text-center">{validationError}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              {event ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}