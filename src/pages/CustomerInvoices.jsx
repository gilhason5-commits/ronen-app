import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomerInvoiceList from "../components/ar/CustomerInvoiceList";
import CustomerInvoiceDialog from "../components/ar/CustomerInvoiceDialog";

export default function CustomerInvoices() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['customerInvoices'],
    queryFn: () => base44.entities.CustomerInvoice.list('-created_date'),
    initialData: [],
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
    initialData: [],
  });

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalReceivable = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.balance || inv.total || 0), 0);

  const handleCreate = () => {
    setSelectedInvoice(null);
    setShowDialog(true);
  };

  const handleEdit = (invoice) => {
    setSelectedInvoice(invoice);
    setShowDialog(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Customer Invoices (AR)</h1>
          <p className="text-stone-500 mt-1">Manage accounts receivable</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-stone-500">Total Receivable</p>
            <p className="text-2xl font-bold text-emerald-600">${totalReceivable.toFixed(2)}</p>
          </div>
          <Button 
            onClick={handleCreate}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CustomerInvoiceList
        invoices={filteredInvoices}
        isLoading={isLoading}
        onEdit={handleEdit}
      />

      {showDialog && (
        <CustomerInvoiceDialog
          invoice={selectedInvoice}
          events={events}
          open={showDialog}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}