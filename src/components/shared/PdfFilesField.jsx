import React, { useId, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// Recipe PDF list + upload button, shared by the dish card and the
// sub-dish card. `value` is the record's pdf_files array.
export default function PdfFilesField({ value = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('אנא העלה קובץ PDF');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange([...(value || []), { name: file.name, url: file_url, uploaded_date: format(new Date(), 'yyyy-MM-dd') }]);
      toast.success('PDF הועלה');
    } catch {
      toast.error('העלאת PDF נכשלה');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index) => {
    if (!window.confirm('למחוק את הקובץ?')) return;
    onChange((value || []).filter((_, i) => i !== index));
  };

  return (
    <div>
      <Label>מסמכי מתכון (PDFs)</Label>
      <p className="text-xs text-stone-500 mb-2">העלה קבצי מתכון, תמונות או הערות בישול</p>
      <div className="space-y-2">
        {(value || []).map((pdf, index) => (
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
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemove(index)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <div>
          <Input type="file" accept="application/pdf" onChange={handleUpload} disabled={uploading} className="hidden" id={inputId} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(inputId)?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'מעלה...' : 'העלה PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
}
