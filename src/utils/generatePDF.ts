import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function generatePDF(element: HTMLElement, filename: string) {
  const saved: { el: HTMLElement; overflow: string; maxHeight: string; height: string; transform: string }[] = [];
  let ancestor: HTMLElement | null = element;
  while (ancestor && ancestor !== document.documentElement) {
    const s = ancestor.style;
    saved.push({ el: ancestor, overflow: s.overflow, maxHeight: s.maxHeight, height: s.height, transform: s.transform });
    s.overflow = 'visible';
    s.maxHeight = 'none';
    s.height = 'auto';
    s.transform = 'none';
    ancestor = ancestor.parentElement;
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
    });
  } finally {
    for (const { el, overflow, maxHeight, height, transform } of saved) {
      el.style.overflow = overflow;
      el.style.maxHeight = maxHeight;
      el.style.height = height;
      el.style.transform = transform;
    }
  }

  const A4_W = 210, A4_H = 297, M = 10;
  const CW = A4_W - M * 2;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const scale = CW / canvas.width;
  const totalH = canvas.height * scale;
  const pageH = A4_H - M * 2;

  if (totalH <= pageH) {
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', M, M, CW, totalH);
  } else {
    const sliceHPx = pageH / scale;
    let srcY = 0, page = 0;
    while (srcY < canvas.height) {
      const h = Math.min(sliceHPx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', M, M, CW, h * scale);
      srcY += h;
      page++;
    }
  }

  pdf.save(filename);
}
