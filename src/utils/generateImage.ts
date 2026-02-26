import html2canvas from 'html2canvas';

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

export async function generateImage(element: HTMLElement, filename: string) {
  const scrollParent = getScrollParent(element);
  const saved: { el: HTMLElement; maxHeight: string; overflow: string }[] = [];

  if (scrollParent) {
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

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
