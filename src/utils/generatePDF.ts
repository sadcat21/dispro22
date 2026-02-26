import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    if (style.overflow === 'auto' || style.overflow === 'scroll' ||
        style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

async function captureWithFullScroll(element: HTMLElement): Promise<HTMLCanvasElement> {
  // Find scrollable parent and temporarily expand it
  const scrollParent = getScrollParent(element);
  const saved: { el: HTMLElement; maxHeight: string; overflow: string }[] = [];

  if (scrollParent) {
    // Remove scroll constraints up the chain
    let p: HTMLElement | null = scrollParent;
    while (p && p !== document.body) {
      const s = p.style;
      saved.push({ el: p, maxHeight: s.maxHeight, overflow: s.overflow });
      p.style.maxHeight = 'none';
      p.style.overflow = 'visible';
      p = p.parentElement;
    }
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  // Restore
  for (const { el, maxHeight, overflow } of saved) {
    el.style.maxHeight = maxHeight;
    el.style.overflow = overflow;
  }

  return canvas;
}

export async function generatePDF(element: HTMLElement, filename: string) {
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const MARGIN_MM = 10;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - (MARGIN_MM * 2);

  const canvas = await captureWithFullScroll(element);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widthPx = canvas.width;
  const heightPx = canvas.height;
  const scaleFactor = CONTENT_WIDTH_MM / widthPx;
  const totalHeightMM = heightPx * scaleFactor;
  const pageContentHeight = A4_HEIGHT_MM - (MARGIN_MM * 2);

  if (totalHeightMM <= pageContentHeight) {
    // Fits on one page
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, totalHeightMM);
  } else {
    // Multi-page: slice the canvas
    const pageHeightPx = pageContentHeight / scaleFactor;
    let srcY = 0;
    let page = 0;

    while (srcY < heightPx) {
      const sliceHeight = Math.min(pageHeightPx, heightPx - srcY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = widthPx;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, srcY, widthPx, sliceHeight, 0, 0, widthPx, sliceHeight);

      const imgData = sliceCanvas.toDataURL('image/png');
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, sliceHeight * scaleFactor);

      srcY += sliceHeight;
      page++;
    }
  }

  pdf.save(filename);
}
