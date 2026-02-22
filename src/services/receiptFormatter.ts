/**
 * ESC/POS Receipt Formatter for 58mm thermal printers
 * Generates binary commands for thermal printing
 */

import { ReceiptItem, ReceiptType } from '@/types/receipt';

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// 58mm printer ≈ 32 chars per line (monospace)
const LINE_WIDTH = 32;

const encoder = new TextEncoder();

function textToBytes(text: string): Uint8Array {
  return encoder.encode(text);
}

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

// ESC/POS Commands
const INIT = cmd(ESC, 0x40); // Initialize printer
const ALIGN_CENTER = cmd(ESC, 0x61, 0x01);
const ALIGN_LEFT = cmd(ESC, 0x61, 0x00);
const ALIGN_RIGHT = cmd(ESC, 0x61, 0x02);
const BOLD_ON = cmd(ESC, 0x45, 0x01);
const BOLD_OFF = cmd(ESC, 0x45, 0x00);
const DOUBLE_HEIGHT = cmd(GS, 0x21, 0x01);
const NORMAL_SIZE = cmd(GS, 0x21, 0x00);
const CUT_PAPER = cmd(GS, 0x56, 0x00);
const FEED_LINES = (n: number) => cmd(ESC, 0x64, n);

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return ' '.repeat(len - str.length) + str;
}

function centerText(str: string, width: number = LINE_WIDTH): string {
  if (str.length >= width) return str.substring(0, width);
  const pad = Math.floor((width - str.length) / 2);
  return ' '.repeat(pad) + str;
}

function line(char: string = '-', width: number = LINE_WIDTH): string {
  return char.repeat(width);
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getReceiptTypeName(type: ReceiptType): string {
  switch (type) {
    case 'direct_sale': return 'BON DE VENTE';
    case 'delivery': return 'BON DE LIVRAISON';
    case 'debt_payment': return 'RECU DE PAIEMENT';
    default: return 'BON';
  }
}

export interface ReceiptData {
  receiptNumber: number;
  receiptType: ReceiptType;
  customerName: string;
  customerPhone?: string | null;
  workerName: string;
  workerPhone?: string | null;
  items: ReceiptItem[];
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod?: string | null;
  notes?: string | null;
  date: Date;
  printCount: number;
  companyName?: string;
  companyAddress?: string;
}

export function formatReceiptForPrint(data: ReceiptData): Uint8Array {
  const parts: Uint8Array[] = [];
  const add = (bytes: Uint8Array) => parts.push(bytes);
  const addText = (text: string) => { add(textToBytes(text)); add(cmd(LF)); };

  // Initialize
  add(INIT);

  // Header - Company name
  add(ALIGN_CENTER);
  add(BOLD_ON);
  add(DOUBLE_HEIGHT);
  addText(data.companyName || 'Laser Food');
  add(NORMAL_SIZE);
  add(BOLD_OFF);

  // Worker info
  addText(`${data.workerName}${data.workerPhone ? ' ' + data.workerPhone : ''}`);
  if (data.companyAddress) addText(data.companyAddress);

  // Receipt type
  add(BOLD_ON);
  addText(`${getReceiptTypeName(data.receiptType)} N° ${String(data.receiptNumber).padStart(6, '0')}`);
  add(BOLD_OFF);

  // Date
  const dateStr = data.date.toLocaleDateString('fr-FR');
  const timeStr = data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  addText(`DATE: ${dateStr} ${timeStr}`);

  // Client
  addText(`CLIENT: ${data.customerName}`);
  if (data.customerPhone) addText(`TEL: ${data.customerPhone}`);

  // Print count
  if (data.printCount > 0) {
    addText(`(Copie ${data.printCount + 1})`);
  }

  add(ALIGN_LEFT);
  addText(line('-'));

  // Items header
  const hdrArticle = padRight('Article', 14);
  const hdrQte = padRight('Qte', 5);
  const hdrPU = padRight('P.U', 6);
  const hdrTotal = padLeft('Total', 7);
  addText(`${hdrArticle}${hdrQte}${hdrPU}${hdrTotal}`);
  addText(line('.'));

  // Items
  let totalBoxes = 0;
  let totalProducts = 0;
  for (const item of data.items) {
    const name = item.productName.length > 14 ? item.productName.substring(0, 14) : item.productName;
    
    let qtyStr = String(item.quantity);
    if (item.giftQuantity && item.giftQuantity > 0) {
      const paid = item.quantity - item.giftQuantity;
      qtyStr = `${paid}+[${item.giftQuantity}]`;
    }

    const pricePart = padRight(String(Math.round(item.unitPrice)), 6);
    const totalPart = padLeft(String(Math.round(item.totalPrice)), 7);

    // If name is long, print on two lines
    if (item.productName.length > 14) {
      addText(item.productName);
      addText(`${padRight('', 14)}${padRight(qtyStr, 5)}${pricePart}${totalPart}`);
    } else {
      addText(`${padRight(name, 14)}${padRight(qtyStr, 5)}${pricePart}${totalPart}`);
    }

    if (item.giftQuantity && item.giftQuantity > 0) {
      addText(`  [CADEAU: ${item.giftQuantity}]`);
    }
    if (item.isPromo) {
      addText(`  [PROMO]`);
    }

    totalBoxes += item.quantity;
    totalProducts++;
  }

  addText(line('-'));

  // Summary
  addText(`N COLLISAGE: ${totalBoxes}  NBR ART: ${totalProducts}`);
  addText(line('-'));

  // Totals
  add(ALIGN_CENTER);
  add(BOLD_ON);

  if (data.discountAmount > 0) {
    addText(`SOUS-TOTAL: ${formatAmount(data.totalAmount + data.discountAmount)} DA`);
    addText(`REMISE: -${formatAmount(data.discountAmount)} DA`);
  }

  addText(`NET A PAYER: ${formatAmount(data.totalAmount)} DA`);
  addText(line('-'));
  addText(`MONTANT PAYE: ${formatAmount(data.paidAmount)} DA`);
  addText(line('-'));

  if (data.remainingAmount > 0) {
    addText(`MONTANT RESTANT: ${formatAmount(data.remainingAmount)} DA`);
  } else {
    addText(`MONTANT RESTANT: 0.00 DA`);
  }

  add(BOLD_OFF);

  if (data.paymentMethod) {
    const methodLabels: Record<string, string> = {
      cash: 'Especes', check: 'Cheque', transfer: 'Virement', receipt: 'Recu',
    };
    addText(`Mode: ${methodLabels[data.paymentMethod] || data.paymentMethod}`);
  }

  if (data.notes) {
    add(ALIGN_LEFT);
    addText(line('-'));
    addText(`Note: ${data.notes}`);
  }

  // Footer
  add(ALIGN_CENTER);
  addText('');
  addText('Merci pour votre confiance');
  add(FEED_LINES(4));
  add(CUT_PAPER);

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * Generate HTML preview of the receipt (for on-screen display)
 */
export function formatReceiptForPreview(data: ReceiptData): string {
  const typeName = getReceiptTypeName(data.receiptType);
  const dateStr = data.date.toLocaleDateString('fr-FR');
  const timeStr = data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  let itemsHtml = '';
  let totalBoxes = 0;
  for (const item of data.items) {
    let qtyStr = String(item.quantity);
    const badges: string[] = [];
    if (item.giftQuantity && item.giftQuantity > 0) {
      const paid = item.quantity - item.giftQuantity;
      qtyStr = `${paid}+${item.giftQuantity}`;
      badges.push('🎁');
    }
    if (item.isPromo) badges.push('🔥');
    
    itemsHtml += `
      <tr>
        <td style="text-align:left;padding:2px 0;">${item.productName} ${badges.join(' ')}</td>
        <td style="text-align:center;">${qtyStr}</td>
        <td style="text-align:right;">${Math.round(item.unitPrice)}</td>
        <td style="text-align:right;">${Math.round(item.totalPrice).toLocaleString()}</td>
      </tr>`;
    totalBoxes += item.quantity;
  }

  return `
    <div style="font-family:monospace;max-width:280px;margin:0 auto;font-size:12px;line-height:1.4;">
      <div style="text-align:center;margin-bottom:8px;">
        <div style="font-size:16px;font-weight:bold;">${data.companyName || 'Laser Food'}</div>
        <div>${data.workerName}${data.workerPhone ? ' ' + data.workerPhone : ''}</div>
        ${data.companyAddress ? `<div>${data.companyAddress}</div>` : ''}
        <div style="font-weight:bold;margin-top:4px;">${typeName} N° ${String(data.receiptNumber).padStart(6, '0')}</div>
        <div>DATE: ${dateStr} ${timeStr}</div>
        <div>CLIENT: ${data.customerName}</div>
        ${data.customerPhone ? `<div>TEL: ${data.customerPhone}</div>` : ''}
        ${data.printCount > 0 ? `<div style="color:#888;">(Copie ${data.printCount + 1})</div>` : ''}
      </div>
      <hr style="border:none;border-top:1px dashed #000;"/>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px dotted #000;">
            <th style="text-align:left;">Article</th>
            <th style="text-align:center;">Qte</th>
            <th style="text-align:right;">P.U</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <hr style="border:none;border-top:1px dashed #000;"/>
      <div style="text-align:center;">
        <div>N COLLISAGE: ${totalBoxes} | NBR ART: ${data.items.length}</div>
      </div>
      <hr style="border:none;border-top:1px dashed #000;"/>
      <div style="text-align:center;font-weight:bold;">
        ${data.discountAmount > 0 ? `
          <div>SOUS-TOTAL: ${formatAmount(data.totalAmount + data.discountAmount)} DA</div>
          <div>REMISE: -${formatAmount(data.discountAmount)} DA</div>
        ` : ''}
        <div>NET A PAYER: ${formatAmount(data.totalAmount)} DA</div>
        <hr style="border:none;border-top:1px dashed #000;"/>
        <div>MONTANT PAYE: ${formatAmount(data.paidAmount)} DA</div>
        <hr style="border:none;border-top:1px dashed #000;"/>
        <div>MONTANT RESTANT: ${formatAmount(data.remainingAmount)} DA</div>
      </div>
      <div style="text-align:center;margin-top:8px;">
        <div>Merci pour votre confiance</div>
      </div>
    </div>`;
}
