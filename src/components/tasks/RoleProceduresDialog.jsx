import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Printer, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function RoleProceduresDialog({ role, open, onClose }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  useEffect(() => {
    if (role && open) {
      setContent(role.procedures || "");
    }
  }, [role, open]);

  const saveMutation = useMutation({
    mutationFn: (procedures) =>
      base44.entities.EmployeeRole.update(role.id, { procedures }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeRoles"] });
      toast.success("נהלים נשמרו");
    },
  });

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const formatted = content.replace(/\n/g, "<br/>");
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>נהלים - ${role?.role_name || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; direction: rtl; line-height: 1.8; }
            h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>נהלים - ${role?.role_name || ""}</h1>
          <div>${formatted}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>נהלים - {role?.role_name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0" dir="rtl">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="כתוב כאן את הנהלים לתפקיד..."
            className="min-h-[350px] resize-y text-base leading-relaxed"
          />
        </div>

        <DialogFooter className="flex gap-2 pt-4">
          <Button variant="outline" onClick={handlePrint} disabled={!content}>
            <Printer className="w-4 h-4 ml-2" />
            הדפסה
          </Button>
          <Button
            onClick={() => saveMutation.mutate(content)}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 ml-2" />
            )}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}