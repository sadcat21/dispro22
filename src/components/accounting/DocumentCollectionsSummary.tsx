import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileCheck2 } from 'lucide-react';

interface DocumentCollectionsSummaryProps {
  workerId: string;
  periodStart: string;
  periodEnd: string;
}

interface CollectedDoc {
  orderId: string;
  customerName: string;
  documentType: string;
  orderTotal: number;
  deliveredAt: string;
}

const fmt = (n: number) => n.toLocaleString();

const extractDate = (v: string): string => v.replace('T', ' ').substring(0, 10);

const docTypeLabel = (t: string) => {
  const map: Record<string, string> = {
    check: 'شيك',
    receipt: 'وصل فيرمو',
    transfer: 'وصل فيرسمو',
    versement: 'وصل فيرسمو',
    virement: 'تحويل بنكي',
  };
  return map[t] || t;
};

const docTypeColor = (t: string) => {
  switch (t) {
    case 'check': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'receipt': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'transfer':
    case 'versement':
    case 'virement': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    default: return 'bg-muted text-muted-foreground';
  }
};

const DocumentCollectionsSummary: React.FC<DocumentCollectionsSummaryProps> = ({ workerId, periodStart, periodEnd }) => {
  const { data: docs, isLoading } = useQuery({
    queryKey: ['session-document-collections', workerId, periodStart, periodEnd],
    queryFn: async () => {
      const startDate = extractDate(periodStart);
      const endDate = extractDate(periodEnd);
      const startTz = startDate + 'T00:00:00+01:00';
      const endTz = endDate + 'T23:59:59+01:00';

      // Get delivered orders by this worker with document payment methods (check, receipt, transfer)
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          invoice_payment_method,
          document_status,
          delivered_at,
          created_at,
          customer:customers!orders_customer_id_fkey(name)
        `)
        .eq('assigned_worker_id', workerId)
        .eq('status', 'delivered')
        .in('invoice_payment_method', ['check', 'receipt', 'transfer', 'versement', 'virement'])
        .gte('delivered_at', startTz)
        .lte('delivered_at', endTz);

      if (error) {
        // Fallback: try with created_at if delivered_at doesn't exist
        const { data: fallbackOrders, error: fallbackError } = await supabase
          .from('orders')
          .select(`
            id,
            total_amount,
            invoice_payment_method,
            document_status,
            created_at,
            customer:customers!orders_customer_id_fkey(name)
          `)
          .eq('assigned_worker_id', workerId)
          .eq('status', 'delivered')
          .in('invoice_payment_method', ['check', 'receipt', 'transfer', 'versement', 'virement'])
          .gte('created_at', startTz)
          .lte('created_at', endTz);

        if (fallbackError) throw fallbackError;

        return (fallbackOrders || []).map((o: any) => ({
          orderId: o.id,
          customerName: o.customer?.name || 'غير معروف',
          documentType: o.invoice_payment_method,
          orderTotal: Number(o.total_amount || 0),
          deliveredAt: o.created_at,
        })) as CollectedDoc[];
      }

      return (orders || []).map((o: any) => ({
        orderId: o.id,
        customerName: o.customer?.name || 'غير معروف',
        documentType: o.invoice_payment_method,
        orderTotal: Number(o.total_amount || 0),
        deliveredAt: o.delivered_at || o.created_at,
      })) as CollectedDoc[];
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!docs || docs.length === 0) return <p className="text-xs text-muted-foreground text-center py-3">لا توجد مستندات محصلة في هذه الفترة</p>;

  // Group by document type
  const grouped = docs.reduce((acc, doc) => {
    const key = doc.documentType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {} as Record<string, CollectedDoc[]>);

  const totalAmount = docs.reduce((s, d) => s + d.orderTotal, 0);

  return (
    <div className="space-y-2.5">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className={`${docTypeColor(type)} text-[10px] px-2 py-0.5`}>
              {docTypeLabel(type)} ({items.length})
            </Badge>
          </div>
          {items.map((doc) => (
            <div key={doc.orderId} className="border rounded-lg p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{doc.customerName}</p>
                  <p className="text-[10px] text-muted-foreground">#{doc.orderId.slice(0, 8)}</p>
                </div>
              </div>
              <span className="font-bold text-sm">{fmt(doc.orderTotal)} DA</span>
            </div>
          ))}
        </div>
      ))}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex justify-between items-center">
        <span className="text-sm font-bold">إجمالي المستندات: {docs.length}</span>
        <span className="font-bold text-primary">{fmt(totalAmount)} DA</span>
      </div>
    </div>
  );
};

export default DocumentCollectionsSummary;
