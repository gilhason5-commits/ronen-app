import React from "react";
import ReactQuill from "react-quill";
import DOMPurify from "dompurify";
import "react-quill/dist/quill.snow.css";

// Protocol body text: basic formatting only — font size, bold, underline.
// Stored as HTML; rows written before formatting existed are plain text and
// are shown (and opened for editing) line by line, as before.
const MODULES = {
  toolbar: [
    [{ size: ["small", false, "large", "huge"] }],
    ["bold", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
  ],
};
const FORMATS = ["size", "bold", "underline", "list", "bullet", "direction", "align"];

const isHtml = (text) => /<\/?(p|br|strong|u|span|ol|ul|li)\b/i.test(text || "");

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Plain text -> one paragraph per line, so old content keeps its line breaks.
export function toEditorHtml(text) {
  if (!text || isHtml(text)) return text || "";
  return text.split("\n").map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`).join("");
}

export function ProtocolEditor({ value, onChange }) {
  return (
    <div className="protocol-rich-text" dir="rtl">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={MODULES}
        formats={FORMATS}
        placeholder="כתוב כאן את תוכן הפרוטוקול..."
      />
    </div>
  );
}

export function ProtocolContent({ content }) {
  if (!isHtml(content)) {
    return <div className="whitespace-pre-wrap text-stone-800 leading-relaxed text-base">{content}</div>;
  }
  return (
    <div className="protocol-rich-text ql-snow">
      <div
        className="ql-editor text-stone-800 leading-relaxed text-base p-0"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
      />
    </div>
  );
}
