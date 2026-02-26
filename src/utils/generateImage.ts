import html2canvas from 'html2canvas';

export async function generateImage(element: HTMLElement, filename: string) {
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

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    for (const { el, overflow, maxHeight, height, transform } of saved) {
      el.style.overflow = overflow;
      el.style.maxHeight = maxHeight;
      el.style.height = height;
      el.style.transform = transform;
    }
  }
}
