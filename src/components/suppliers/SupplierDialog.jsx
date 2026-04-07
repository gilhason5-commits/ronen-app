import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Plus, Trash2, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SupplierDialog({ supplier, open, onClose }) {
  const queryClient = useQueryClient();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    accounting_phone: '',
    payment_method: '',
    payment_terms: '',
    supplier_category_id: '',
    supplier_category_name: '',
    supplier_type: 'daily',
    status: 'active',
    notes: '',
    pdf_files: [],
    items_supplied: []
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['supplierCategories'],
    queryFn: () => base44.entities.Supplier_Category.list('display_order'),
    initialData: []
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        ...supplier,
        pdf_files: supplier.pdf_files || []
      });
    }
  }, [supplier]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (supplier?.id) {
        return base44.entities.Supplier.update(supplier.id, data);
      } else {
        return base44.entities.Supplier.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(supplier ? 'הספק עודכן' : 'הספק נוצר');
      onClose();
    },
    onError: () => {
      toast.error('שמירת הספק נכשלה');
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryName) => {
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.display_order || 0))
        : 0;
      
      return await base44.entities.Supplier_Category.create({
        name: categoryName,
        display_order: maxOrder + 1
      });
    },
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['supplierCategories'] });
      setFormData({
        ...formData,
        supplier_category_id: newCategory.id,
        supplier_category_name: newCategory.name
      });
      setShowNewCategory(false);
      setNewCategoryName('');
      toast.success('הקטגוריה נוצרה');
    },
    onError: () => {
      toast.error('יצירת הקטגוריה נכשלה');
    }
  });

  const handleCategoryChange = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    setFormData({
      ...formData,
      supplier_category_id: categoryId,
      supplier_category_name: category?.name || ''
    });
  };

  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      createCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('אנא העלה קובץ PDF');
      return;
    }

    setUploadingPdf(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newPdf = {
        name: file.name,
        url: file_url,
        uploaded_date: format(new Date(), 'yyyy-MM-dd')
      };
      
      setFormData({
        ...formData,
        pdf_files: [...(formData.pdf_files || []), newPdf]
      });

      // Automatically create a supplier invoice from the PDF
      if (supplier?.id) {
        await base44.entities.SupplierInvoice.create({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          invoice_number: `INV-${Date.now()}`,
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0,
          status: 'draft',
          balance: 0,
          pdf_url: file_url,
          pdf_name: file.name,
          notes: `Auto-generated from uploaded PDF: ${file.name}`
        });
        queryClient.invalidateQueries({ queryKey: ['supplierInvoices'] });
      }
      
      toast.success('PDF הועלה והחשבונית נוצרה');
    } catch (error) {
      toast.error('העלאת PDF נכשלה');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleRemovePdf = (index) => {
    const newPdfFiles = [...formData.pdf_files];
    newPdfFiles.splice(index, 1);
    setFormData({ ...formData, pdf_files: newPdfFiles });
  };

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Supplier.delete(supplier.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('הספק נמחק');
      onClose();
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('מחיקת הספק נכשלה');
    }
  });

  const handleDelete = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הספק? פעולה זו אינה ניתנת לביטול.')) {
      deleteMutation.mutate();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'עריכת ספק' : 'ספק חדש'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>שם ספק *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div>
              <Label>איש קשר</Label>
              <Input
                value={formData.contact_person}
                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
              />
            </div>

            <div>
              <Label>סוג ספק</Label>
              <Select
                value={formData.supplier_type || 'daily'}
                onValueChange={(value) => setFormData({...formData, supplier_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">יומי</SelectItem>
                  <SelectItem value="weekly">שבועי</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>סטטוס</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="inactive">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>אימייל</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div>
              <Label>טלפון</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="col-span-2">
              <Label>טלפון הנהלת חשבונות</Label>
              <Input
                type="tel"
                placeholder="מספר טלפון של מחלקת הנהלת חשבונות"
                value={formData.accounting_phone}
                onChange={(e) => setFormData({...formData, accounting_phone: e.target.value})}
              />
            </div>

            <div>
              <Label>קטגוריה</Label>
              {!showNewCategory ? (
                <div className="flex gap-2">
                  <Select
                    value={formData.supplier_category_id}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר קטגוריה..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowNewCategory(true)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="שם קטגוריה חדשה..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button 
                    type="button" 
                    size="sm"
                    onClick={handleCreateCategory}
                  >
                    הוספה
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setShowNewCategory(false);
                      setNewCategoryName('');
                    }}
                  >
                    ביטול
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label>אמצעי תשלום</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({...formData, payment_method: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר אמצעי תשלום..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">העברה בנקאית</SelectItem>
                  <SelectItem value="Check">צ'ק</SelectItem>
                  <SelectItem value="Cash">מזומן</SelectItem>
                  <SelectItem value="Credit Card">כרטיס אשראי</SelectItem>
                  <SelectItem value="Wire Transfer">העברה בנקאית</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>תנאי תשלום</Label>
              <Input
                placeholder="לדוגמה, שוטף+30, תשלום במעמד הקבלה"
                value={formData.payment_terms}
                onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
              />
            </div>

            <div className="col-span-2">
              <Label>מסמכי חשבוניות (PDFs)</Label>
              <p className="text-xs text-stone-500 mb-2">העלה קבצי חשבוניות - הם יופיעו אוטומטית בחשבוניות ספקים</p>
              <div className="space-y-2">
                {formData.pdf_files?.map((pdf, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-stone-50 rounded border">
                    <FileText className="w-4 h-4 text-red-600" />
                    <a 
                      href={pdf.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-blue-600 hover:underline truncate"
                    >
                      {pdf.name}
                    </a>
                    <span className="text-xs text-stone-500">{pdf.uploaded_date}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemovePdf(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    disabled={uploadingPdf || !supplier?.id}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('pdf-upload')?.click()}
                    disabled={uploadingPdf || !supplier?.id}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingPdf ? 'מעלה...' : 'העלה PDF חשבונית'}
                  </Button>
                  {!supplier?.id && (
                    <p className="text-xs text-stone-500 mt-1">שמור ספק תחילה כדי להעלות חשבוניות</p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <Label>הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className={supplier?.id ? "sm:justify-between" : ""}>
            {supplier?.id && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                מחיקה
              </Button>
            )}
            <div className="flex gap-2 justify-end w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                ביטול
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {supplier ? 'עדכון' : 'יצירת'} ספק
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}