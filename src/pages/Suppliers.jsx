import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Mail, Phone, CreditCard, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupplierDialog from "../components/suppliers/SupplierDialog";
import SupplierProductsDialog from "../components/suppliers/SupplierProductsDialog";

export default function Suppliers() {
  const [showDialog, setShowDialog] = useState(false);
  const [showProductsDialog, setShowProductsDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const data = await base44.entities.Supplier.list();
      return data.sort((a, b) => a.name?.localeCompare(b.name, 'he'));
    },
    initialData: [],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['supplierCategories'],
    queryFn: () => base44.entities.Supplier_Category.list('display_order'),
    initialData: []
  });

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || 
                           supplier.supplier_category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = () => {
    setSelectedSupplier(null);
    setShowDialog(true);
  };

  const handleEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setShowDialog(true);
  };

  const handleViewProducts = (supplier) => {
    setSelectedSupplier(supplier);
    setShowProductsDialog(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">ספקים</h1>
          <p className="text-stone-500 mt-1">ניהול קשרי ספקים וקטגוריות</p>
        </div>
        <Button 
          onClick={handleCreate}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          ספק חדש
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="חיפוש ספקים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList>
            <TabsTrigger value="all">הכל</TabsTrigger>
            {categories.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => (
          <Card key={supplier.id} className="border-stone-200 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-stone-900">{supplier.name}</h3>
                  {supplier.supplier_category_id && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {categories.find(cat => cat.id === supplier.supplier_category_id)?.name}
                    </Badge>
                  )}
                  <Badge className={`mt-1 text-xs ${supplier.supplier_type === 'weekly' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {supplier.supplier_type === 'weekly' ? 'שבועי' : 'יומי'}
                  </Badge>
                </div>
                <Badge className={supplier.status === 'active' ? 
                  "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-700"}>
                  {supplier.status === 'active' ? 'פעיל' : 'לא פעיל'}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                {supplier.contact_person && (
                  <p className="text-sm text-stone-600">{supplier.contact_person}</p>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Phone className="w-3 h-3" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.accounting_phone && (
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Phone className="w-3 h-3 text-blue-500" />
                    <span className="text-xs">
                      הנהלת חשבונות: {supplier.accounting_phone}
                    </span>
                  </div>
                )}
                {supplier.payment_method && (
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <CreditCard className="w-3 h-3" />
                    <span>{supplier.payment_method}</span>
                  </div>
                )}
                {supplier.payment_terms && (
                  <p className="text-xs text-stone-500">תנאים: {supplier.payment_terms}</p>
                )}
              </div>

              {supplier.items_supplied?.length > 0 && (
                <p className="text-xs text-stone-500 mb-3">
                  מספק {supplier.items_supplied.length} פריטים
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewProducts(supplier)}
                >
                  <Package className="w-3 h-3 mr-2" />
                  מוצרים
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(supplier)}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  עריכה
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSuppliers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-stone-500">לא נמצאו ספקים</p>
          </CardContent>
        </Card>
      )}

      {showDialog && (
        <SupplierDialog
          supplier={selectedSupplier}
          open={showDialog}
          onClose={() => setShowDialog(false)}
        />
      )}

      {showProductsDialog && (
        <SupplierProductsDialog
          supplier={selectedSupplier}
          open={showProductsDialog}
          onClose={() => setShowProductsDialog(false)}
        />
      )}
    </div>
  );
}