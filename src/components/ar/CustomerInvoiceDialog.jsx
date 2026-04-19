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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CustomerInvoiceDialog({ invoice, events, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    invoice_number: '',
    event_id: '',
    event_name: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    line_items: [],
    amount: 0,
    tax: 0,
    total: 0,
    due_date: '',
    status: 'draft',
    payments: [],
    balance: 0
  });

  useEffect(() => {
    if (invoice) {
      setFormData(invoice);
    }
  }, [invoice]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const calculatedData = calculateInvoice(data);
      if (invoice?.id) {
        return base44.entities.CustomerInvoice.update(invoice.id, calculatedData);
      } else {
        return base44.entities.CustomerInvoice.create(calculatedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerInvoices'] });
      toast.success(invoice ? 'Invoice updated' : 'Invoice created');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save invoice');
    }
  });

  const calculateInvoice = (data) => {
    const amount = data.line_items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    const total = amount + (data.tax || 0);
    const paidAmount = data.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const balance = total - paidAmount;
    
    return { ...data, amount, total, balance };
  };

  const handleEventChange = (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      const lineItems = [{
        description: `Event: ${event.name}`,
        quantity: 1,
        unit_price: event.event_price || 0,
        total: event.event_price || 0
      }];
      
      setFormData({
        ...formData,
        event_id: eventId,
        event_name: event.name,
        line_items: lineItems
      });
    }
  };

  const handleAddLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...(formData.line_items || []),
        { description: '', quantity: 1, unit_price: 0, total: 0 }
      ]
    });
  };

  const handleRemoveLineItem = (index) => {
    setFormData({
      ...formData,
      line_items: formData.line_items.filter((_, i) => i !== index)
    });
  };

  const handleLineItemChange = (index, field, value) => {
    const newItems = [...formData.line_items];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unit_price || 0);
    }
    
    setFormData({ ...formData, line_items: newItems });
  };

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Edit Customer Invoice' : 'New Customer Invoice'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoice_number}
                onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                placeholder="Auto-generated if empty"
              />
            </div>

            <div>
              <Label>Linked Event</Label>
              <Select
                value={formData.event_id}
                onValueChange={handleEventChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {event.event_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Customer Name *</Label>
              <Input
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>Customer Email</Label>
              <Input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
              />
            </div>

            <div>
              <Label>Customer Phone</Label>
              <Input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
              />
            </div>

            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
              />
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
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Line Items</Label>
              <Button type="button" size="sm" onClick={handleAddLineItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Line
              </Button>
            </div>
            <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
              {formData.line_items?.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                      placeholder="Item description..."
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={item.quantity || ''}
                      onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Unit Price</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={item.unit_price || ''}
                      onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Total</Label>
                    <p className="text-sm font-medium">${(item.total || 0).toFixed(2)}</p>
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLineItem(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Amount:</span>
                <span className="font-semibold">
                  ${(formData.line_items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <Label className="text-sm">Tax:</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.tax || ''}
                  onChange={(e) => setFormData({...formData, tax: parseFloat(e.target.value) || 0})}
                  className="w-32"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-lg text-emerald-600">
                  ${((formData.line_items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0) + (formData.tax || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => handleSubmit()} className="bg-emerald-600 hover:bg-emerald-700">
              {invoice ? 'Update' : 'Create'} Invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}