import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export default function DepartmentPrintPreview({ open, onOpenChange, htmlContent, title, headerInfo }) {
  const iframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(2000);

  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow.print();
    }
  };

  // Listen for messages from iframe to adjust height
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'resize' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height + 60);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const hi = headerInfo || {};

  const headerBarHtml = `
    <div class="page-header-bar">
      <div class="page-header-right">
        <span class="page-header-dept">${hi.deptName || ''}</span>
        <span class="page-header-sep">|</span>
        <span>${hi.eventName || ''}</span>
        <span class="page-header-sep">|</span>
        <span>${hi.eventDate || '-'}</span>
        <span class="page-header-sep">|</span>
        <span>${hi.eventTime || '-'}</span>
        <span class="page-header-sep">|</span>
        <span>${hi.guestCount || 0} סועדים</span>
      </div>
      <div class="page-header-left">
        <span class="page-header-time">${hi.printTimestamp || ''}</span>
        <span class="page-header-sep">|</span>
        <span class="page-number-placeholder"></span>
      </div>
    </div>
  `;

  const fullHtml = `
    <html dir="rtl">
      <head>
        <title>${title || 'דוח מחלקה'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap');

          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Heebo', Arial, sans-serif;
            direction: rtl;
            font-size: 12px;
            color: #333;
            background: #9e9e9e;
            padding: 20px;
          }

          /* Preview mode - simulated pages */
          .preview-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 30px;
          }

          .preview-page {
            width: 210mm;
            min-height: 281mm;
            background: white;
            padding: 8mm 10mm 8mm 10mm;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .page-header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            font-weight: bold;
            border-bottom: 2px solid #333;
            padding-bottom: 6px;
            margin-bottom: 10px;
            flex-shrink: 0;
          }
          .page-header-right {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .page-header-left {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .page-header-dept {
            background-color: #333;
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
          }
          .page-header-sep { color: #999; }
          .page-header-time {
            color: #777;
            font-size: 9px;
            font-weight: normal;
          }
          .page-number {
            font-size: 10px;
            color: #555;
          }

          .page-content {
            flex: 1;
            overflow: hidden;
          }

          .page-footer {
            text-align: center;
            font-size: 9px;
            color: #999;
            padding-top: 6px;
            border-top: 1px solid #ddd;
            margin-top: auto;
            flex-shrink: 0;
          }

          /* Hide native print wrapper on screen */
          .print-wrapper {
            display: none;
            width: 100%;
          }

          h1, h2, h3 { page-break-after: avoid; break-after: avoid; }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 8px;
          }
          th {
            padding: 6px 8px;
            text-align: right;
            border-bottom: 2px solid #333;
            background-color: #f5f5f5;
          }
          td {
            padding: 4px 8px;
            border-bottom: 1px solid #ddd;
          }

          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
            }
            
            .preview-container {
              display: block !important;
              gap: 0;
            }

            .print-wrapper {
              display: none !important;
            }

            /* Lock the simulated page to safely fit a physical A4 paper */
            .preview-page {
              box-shadow: none !important;
              margin: 0 !important;
              padding: 8mm 10mm !important; 
              width: 100% !important;
              
              /* Force height slightly under 297mm to prevent spillover */
              height: 296mm !important; 
              min-height: auto !important;
              max-height: 296mm !important;
              box-sizing: border-box !important;
              
              /* Force physical page breaks */
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important; /* Hide stray pixels rather than creating a new page */
            }

            /* Prevent an empty blank page at the very end of the document */
            .preview-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }

            /* Strip ALL browser margins so our 296mm height fits perfectly */
            @page {
              size: A4;
              margin: 0; 
            }
          }
        </style>
      </head>
      <body>
        <div class="source-content" style="display:none;">${(htmlContent || '').replace(/`/g, '&#96;').replace(/<\/script/g, '&lt;/script')}</div>
        
        <div class="preview-container" id="preview-container"></div>
        
        <table class="print-wrapper" id="print-wrapper">
          <thead>
            <tr><td id="print-header-cell" style="padding-bottom: 10px;"></td></tr>
          </thead>
          <tbody>
            <tr><td id="print-body-cell"></td></tr>
          </tbody>
        </table>

        <script>
          function startLayout() {
            var sourceEl = document.querySelector('.source-content');
            var previewContainer = document.getElementById('preview-container');
            var printHeaderCell = document.getElementById('print-header-cell');
            var printBodyCell = document.getElementById('print-body-cell');
            if (!sourceEl || !previewContainer) return;

            var headerTemplate = \`${headerBarHtml.replace(/`/g, '\\`')}\`;

            // === Build native print layout (table with repeating thead) ===
            // Now that the elements exist in the HTML, this will successfully populate the print wrapper!
            if (printHeaderCell && printBodyCell) {
              printHeaderCell.innerHTML = headerTemplate;
              // Keep the page number placeholder visible in print - CSS @page counter handles numbering
              var ph = printHeaderCell.querySelector('.page-number-placeholder');
              if (ph) {
                ph.className = 'page-number';
                ph.textContent = '';
              }
              
              printBodyCell.innerHTML = sourceEl.innerHTML;
            }

            // === Build screen preview layout (simulated A4 pages) ===
            var measureDiv = document.createElement('div');
            measureDiv.style.cssText = 'position:absolute; left:-9999px; top:0; width:190mm; font-family:Heebo,Arial,sans-serif; font-size:12px; direction:rtl; visibility:hidden;';
            measureDiv.innerHTML = sourceEl.innerHTML;
            document.body.appendChild(measureDiv);

            measureDiv.offsetHeight; // Force layout recalculation

            var maxPageHeight = 900;
            var pages = [];
            var currentPageBlocks = [];
            var currentHeight = 0;

            function flushPage() {
              if (currentPageBlocks.length === 0) return;
              pages.push(currentPageBlocks.map(function(b) { return b.outerHTML; }).join(''));
              currentPageBlocks = [];
              currentHeight = 0;
            }

            function flattenBlocks(parent) {
              var result = [];
              var children = parent.children;
              for (var i = 0; i < children.length; i++) {
                var child = children[i];
                var tag = child.tagName ? child.tagName.toLowerCase() : '';
                if (tag !== 'div') {
                  result.push(child);
                  continue;
                }
                var style = child.getAttribute('style') || '';
                if (style.indexOf('page-break-inside') !== -1 && style.indexOf('avoid') !== -1) {
                  result.push(child);
                  continue;
                }
                if (style.indexOf('page-break-after') !== -1 && style.indexOf('avoid') !== -1) {
                  result.push(child);
                  continue;
                }
                var nested = flattenBlocks(child);
                if (nested.length > 0 && style.indexOf('page-break-before') !== -1 && style.indexOf('always') !== -1) {
                  var existingStyle = nested[0].getAttribute('style') || '';
                  nested[0].setAttribute('style', existingStyle + '; page-break-before: always;');
                }
                result = result.concat(nested);
              }
              return result;
            }

            var blocks = flattenBlocks(measureDiv);

            if (blocks.length <= 1) {
              var allDivs = measureDiv.querySelectorAll('div[style*="page-break-inside"]');
              if (allDivs.length > 0) blocks = Array.prototype.slice.call(allDivs);
            }

            if (blocks.length <= 1) {
              var allChildren = measureDiv.querySelectorAll('div[style*="margin-bottom"], div[style*="margin-top"], div[style*="border-top"], h3');
              if (allChildren.length > 0) blocks = Array.prototype.slice.call(allChildren);
            }

            var groupedBlocks = [];
            for (var bi = 0; bi < blocks.length; bi++) {
              var bstyle = blocks[bi].getAttribute ? (blocks[bi].getAttribute('style') || '') : '';
              var isHeader = bstyle.indexOf('page-break-after') !== -1 && bstyle.indexOf('avoid') !== -1;
              if (isHeader && bi + 1 < blocks.length) {
                var wrapper = document.createElement('div');
                wrapper.style.cssText = 'page-break-inside: avoid;';
                wrapper.appendChild(blocks[bi].cloneNode(true));
                
                var nextStyle = blocks[bi+1].getAttribute ? (blocks[bi+1].getAttribute('style') || '') : '';
                var nextIsSubHeader = nextStyle.indexOf('page-break-after') !== -1 && nextStyle.indexOf('avoid') !== -1;
                wrapper.appendChild(blocks[bi+1].cloneNode(true));
                bi++;
                
                if (nextIsSubHeader && bi + 1 < blocks.length) {
                  wrapper.appendChild(blocks[bi+1].cloneNode(true));
                  bi++;
                }
                measureDiv.appendChild(wrapper);
                wrapper.offsetHeight; 
                groupedBlocks.push(wrapper);
              } else {
                groupedBlocks.push(blocks[bi]);
              }
            }

            groupedBlocks.forEach(function(block) {
              var style = block.getAttribute ? (block.getAttribute('style') || '') : '';
              var hasPageBreak = style.indexOf('page-break-before') !== -1 && style.indexOf('always') !== -1;

              if (hasPageBreak && currentPageBlocks.length > 0) flushPage();

              var blockHeight = block.offsetHeight + 10;
              if (currentHeight + blockHeight > maxPageHeight && currentPageBlocks.length > 0) flushPage();

              currentPageBlocks.push(block);
              currentHeight += blockHeight;
            });
            flushPage();

            document.body.removeChild(measureDiv);

            var totalPages = pages.length;
            previewContainer.innerHTML = '';

            pages.forEach(function(pageContent, idx) {
              var pageNum = idx + 1;
              var pageEl = document.createElement('div');
              pageEl.className = 'preview-page';

              var headerDiv = document.createElement('div');
              headerDiv.innerHTML = headerTemplate;
              var headerBar = headerDiv.firstElementChild;
              var pnPlaceholder = headerBar.querySelector('.page-number-placeholder');
              if (pnPlaceholder) {
                pnPlaceholder.className = 'page-number';
                pnPlaceholder.textContent = 'עמוד ' + pageNum + ' מתוך ' + totalPages;
              }
              pageEl.appendChild(headerBar);

              var contentDiv = document.createElement('div');
              contentDiv.className = 'page-content';
              contentDiv.innerHTML = pageContent;
              pageEl.appendChild(contentDiv);

              var footerDiv = document.createElement('div');
              footerDiv.className = 'page-footer';
              footerDiv.textContent = 'עמוד ' + pageNum + ' מתוך ' + totalPages;
              pageEl.appendChild(footerDiv);

              previewContainer.appendChild(pageEl);
            });

            if (pages.length === 0) {
              var emptyPage = document.createElement('div');
              emptyPage.className = 'preview-page';
              var headerDiv2 = document.createElement('div');
              headerDiv2.innerHTML = headerTemplate;
              emptyPage.appendChild(headerDiv2.firstElementChild);
              var emptyContent = document.createElement('div');
              emptyContent.className = 'page-content';
              emptyContent.innerHTML = '<p style="text-align:center; padding: 40px; color:#999;">אין תוכן להצגה</p>';
              emptyPage.appendChild(emptyContent);
              previewContainer.appendChild(emptyPage);
            }

            setTimeout(function() {
              var totalHeight = previewContainer.scrollHeight + 60;
              window.parent.postMessage({ type: 'resize', height: totalHeight }, '*');
            }, 200);
          }

          document.addEventListener('DOMContentLoaded', function() {
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(function() {
                setTimeout(startLayout, 100);
              });
            } else {
              setTimeout(startLayout, 300);
            }
          });
        </script>
      </body>
    </html>
  `;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[900px] h-[90vh] flex flex-col p-0" dir="rtl">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <DialogTitle className="text-lg font-bold">{title || 'תצוגה מקדימה'}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Printer className="w-4 h-4" />
              הדפס
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-400">
          <iframe
            ref={iframeRef}
            srcDoc={fullHtml}
            style={{ width: '100%', height: iframeHeight + 'px', border: 'none' }}
            title="תצוגה מקדימה"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}