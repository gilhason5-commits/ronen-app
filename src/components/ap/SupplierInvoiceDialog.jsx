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

export default function SupplierInvoiceDialog({ invoice, suppliers, open, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    invoice_number: '',
    supplier_id: '',
    supplier_name: '',
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    due_date: '',
    status: 'pending',
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
        return base44.entities.SupplierInvoice.update(invoice.id, calculatedData);
      } else {
        return base44.entities.SupplierInvoice.create(calculatedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] });
      toast.success(invoice ? 'Invoice updated' : 'Invoice created');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save invoice');
    }
  });

  const calculateInvoice = (data) => {
    const subtotal = data.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    const total = subtotal + (data.tax || 0);
    const paidAmount = data.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const balance = total - paidAmount;
    
    return { ...data, subtotal, total, balance };
  };

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setFormData({
      ...formData,
      supplier_id: supplierId,
      supplier_name: supplier?.name || ''
    });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...(formData.items || []),
        { ingredient_name: '', qty: 0, unit: '', unit_price: 0, total: 0 }
      ]
    });
  };

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'qty' || field === 'unit_price') {
      newItems[index].total = (newItems[index].qty || 0) * (newItems[index].unit_price || 0);
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Edit Supplier Invoice' : 'New Supplier Invoice'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoice_number}
                onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
              />
            </div>

            <div>
              <Label>Supplier *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={handleSupplierChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Invoice Items</Label>
              <Button type="button" size="sm" onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="border rounded-lg p-4 space-y-3 max-h-80 overflow-y-auto">
              {formData.items?.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={item.ingredient_name}
                      onChange={(e) => handleItemChange(index, 'ingredient_name', e.target.value)}
                      placeholder="Item name..."
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={item.qty || ''}
                      onChange={(e) => handleItemChange(index, 'qty', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={item.unit}
                      onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Price</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={item.unit_price || ''}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
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
                      onClick={() => handleRemoveItem(index)}
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
                <span className="text-sm">Subtotal:</span>
                <span className="font-semibold">
                  ${(formData.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0).toFixed(2)}
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
                <span className="font-bold text-lg">
                  ${((formData.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0) + (formData.tax || 0)).toFixed(2)}
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