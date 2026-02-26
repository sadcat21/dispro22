import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function generatePDF(element: HTMLElement, filename: string) {
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const MARGIN_MM = 10;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - (MARGIN_MM * 2);
  const SECTION_GAP_MM = 3;

  // Find sections marked with data-pdf-section, or fallback to direct children
  let sections = Array.from(element.querySelectorAll('[data-pdf-section]')) as HTMLElement[];
  if (sections.length === 0) {
    sections = [element];
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let currentY = MARGIN_MM;
  let isFirstSection = true;

  for (const section of sections) {
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const widthPx = canvas.width;
    const heightPx = canvas.height;
    const scaleFactor = CONTENT_WIDTH_MM / widthPx;
    const heightMM = heightPx * scaleFactor;

    const remainingSpace = A4_HEIGHT_MM - MARGIN_MM - currentY;

    if (heightMM > remainingSpace && !isFirstSection) {
      pdf.addPage();
      currentY = MARGIN_MM;
    }

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', MARGIN_MM, currentY, CONTENT_WIDTH_MM, heightMM);
    currentY += heightMM + SECTION_GAP_MM;
    isFirstSection = false;
  }

  pdf.save(filename);
}
