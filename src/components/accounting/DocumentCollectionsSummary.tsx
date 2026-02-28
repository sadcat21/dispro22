import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileCheck2, Truck, Clock } from 'lucide-react';

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
  source: 'delivery' | 'pending_collection';
}

const fmt = (n: number) => n.toLocaleString();
const extractDate = (v: string): string => v.replace('T', ' ').substring(0, 10);

const docTypeLabel = (t: string) => {
  const map: Record<string, string> = { check: 'شيك', receipt: 'وصل فيرمو', transfer: 'وصل فيرسمو', versement: 'وصل فيرسمو', virement: 'تحويل بنكي' };
  return map[t] || t;
};

const docTypeColor = (t: string) => {
  switch (t) {
    case 'check': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'receipt': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    default: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
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

      const result: CollectedDoc[] = [];

      // 1. Direct delivery documents - orders delivered with doc payment methods
      const { data: deliveryOrders } = await supabase
        .from('orders')
        .select(`id, total_amount, invoice_payment_method, document_status, created_at, customer:customers!orders_customer_id_fkey(name)`)
        .eq('assigned_worker_id', workerId)
        .eq('status', 'delivered')
        .in('invoice_payment_method', ['check', 'receipt', 'transfer', 'versement', 'virement'])
        .gte('created_at', startTz)
        .lte('created_at', endTz);

      for (const o of (deliveryOrders || [])) {
        result.push({
          orderId: o.id,
          customerName: (o.customer as any)?.name || 'غير معروف',
          documentType: o.invoice_payment_method || 'check',
          orderTotal: Number(o.total_amount || 0),
          source: 'delivery',
        });
      }

      // 2. Pending document collections - from document_collections table
      const { data: pendingCollections } = await supabase
        .from('document_collections')
        .select(`id, action, collection_date, order_id, order:orders!document_collections_order_id_fkey(id, total_amount, invoice_payment_method, customer:customers!orders_customer_id_fkey(name))`)
        .eq('worker_id', workerId)
        .in('action', ['collected', 'partial_payment', 'full_payment'])
        .gte('collection_date', startDate)
        .lte('collection_date', endDate);

      const deliveryOrderIds = new Set(result.map(r => r.orderId));

      for (const c of (pendingCollections || [])) {
        const order = c.order as any;
        if (!order || deliveryOrderIds.has(order.id)) continue;
        result.push({
          orderId: order.id,
          customerName: order.customer?.name || 'غير معروف',
          documentType: order.invoice_payment_method || 'check',
          orderTotal: Number(order.total_amount || 0),
          source: 'pending_collection',
        });
      }

      return result;
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!docs || docs.length === 0) return <p className="text-xs text-muted-foreground text-center py-3">لا توجد مستندات محصلة في هذه الفترة</p>;

  const deliveryDocs = docs.filter(d => d.source === 'delivery');
  const pendingDocs = docs.filter(d => d.source === 'pending_collection');
  const totalAmount = docs.reduce((s, d) => s + d.orderTotal, 0);

  const renderDocList = (items: CollectedDoc[]) => {
    const grouped = items.reduce((acc, doc) => {
      if (!acc[doc.documentType]) acc[doc.documentType] = [];
      acc[doc.documentType].push(doc);
      return acc;
    }, {} as Record<string, CollectedDoc[]>);

    return Object.entries(grouped).map(([type, list]) => (
      <div key={type} className="space-y-1.5">
        <Badge className={`${docTypeColor(type)} text-[10px] px-2 py-0.5`}>
          {docTypeLabel(type)} ({list.length})
        </Badge>
        {list.map(doc => (
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
    ));
  };

  return (
    <div className="space-y-3">
      {/* Direct delivery documents */}
      {deliveryDocs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-700 dark:text-green-400">
            <Truck className="w-3.5 h-3.5" />
            <span>مستندات مستلمة أثناء التوصيل ({deliveryDocs.length})</span>
          </div>
          <div className="border-2 border-green-200 dark:border-green-900/40 rounded-xl p-2.5 space-y-2 bg-green-50/30 dark:bg-green-900/10">
            {renderDocList(deliveryDocs)}
          </div>
        </div>
      )}

      {/* Pending documents collected */}
      {pendingDocs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
            <Clock className="w-3.5 h-3.5" />
            <span>مستندات معلقة تم تحصيلها ({pendingDocs.length})</span>
          </div>
          <div className="border-2 border-orange-200 dark:border-orange-900/40 rounded-xl p-2.5 space-y-2 bg-orange-50/30 dark:bg-orange-900/10">
            {renderDocList(pendingDocs)}
          </div>
        </div>
      )}

      {/* Total */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex justify-between items-center">
        <span className="text-sm font-bold">إجمالي المستندات: {docs.length}</span>
        <span className="font-bold text-primary">{fmt(totalAmount)} DA</span>
      </div>
    </div>
  );
};

export default DocumentCollectionsSummary;
