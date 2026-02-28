import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Banknote, HandCoins, TrendingDown, FileCheck2, Stamp, Coins,
  Truck, PackageCheck, PackageX, AlertTriangle, ClipboardList
} from 'lucide-react';
import { SessionCalculations } from '@/hooks/useSessionCalculations';

interface WorkerHandoverSummaryProps {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  calc: SessionCalculations;
  coinAmount: number;
}

const fmt = (n: number) => n.toLocaleString();

interface SummaryRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
  sub?: string;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ icon, label, value, color = '', sub }) => (
  <div className="flex items-center gap-2 py-1.5">
    <div className="w-6 h-6 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-xs font-medium">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground ms-1">({sub})</span>}
    </div>
    <span className={`text-xs font-bold shrink-0 ${color}`}>{value}</span>
  </div>
);

const extractDate = (v: string): string => v.replace('T', ' ').substring(0, 10);

const WorkerHandoverSummary: React.FC<WorkerHandoverSummaryProps> = ({
  workerId, periodStart, periodEnd, calc, coinAmount,
}) => {
  const { data: stats } = useQuery({
    queryKey: ['worker-handover-stats', workerId, periodStart, periodEnd],
    queryFn: async () => {
      const startDate = extractDate(periodStart);
      const endDate = extractDate(periodEnd);
      const startTz = startDate + 'T00:00:00+01:00';
      const endTz = endDate + 'T23:59:59+01:00';

      // Delivery orders
      const { data: deliveryOrders } = await supabase
        .from('orders')
        .select('id, status, payment_status, invoice_payment_method, document_status, document_verification, payment_type, invoice_received_at')
        .eq('assigned_worker_id', workerId)
        .eq('status', 'delivered')
        .gte('updated_at', startTz)
        .lte('updated_at', endTz);

      const orders = deliveryOrders || [];

      // Count document types collected during delivery
      let checksCount = 0;
      let versementCount = 0;
      let virementCount = 0;

      for (const o of orders) {
        const method = String(o.invoice_payment_method || '').toLowerCase();
        const docStatus = String(o.document_status || '');
        const verification = o.document_verification as any;

        const isCollected = docStatus === 'received' || docStatus === 'verified' ||
          (docStatus === 'pending' && verification && typeof verification === 'object' && verification.status !== 'not_received' && method === 'check');

        if (!isCollected) continue;

        if (method === 'check') checksCount++;
        else if (method === 'receipt' || method === 'versement') versementCount++;
        else if (method === 'transfer' || method === 'virement') virementCount++;
      }

      // Pending doc collections
      const { data: pendingCollections } = await supabase
        .from('document_collections')
        .select('id, order:orders!document_collections_order_id_fkey(invoice_payment_method)')
        .eq('worker_id', workerId)
        .eq('action', 'collected')
        .neq('status', 'rejected')
        .gte('collection_date', startDate)
        .lte('collection_date', endDate);

      for (const c of (pendingCollections || [])) {
        const method = String((c.order as any)?.invoice_payment_method || '').toLowerCase();
        if (method === 'check') checksCount++;
        else if (method === 'receipt' || method === 'versement') versementCount++;
        else if (method === 'transfer' || method === 'virement') virementCount++;
      }

      // Stamped invoices
      const stampedTotal = orders.filter(o =>
        o.payment_type === 'with_invoice' && ['check', 'cash'].includes(String(o.invoice_payment_method || '').toLowerCase())
      ).length;
      const stampedReceived = orders.filter(o =>
        o.payment_type === 'with_invoice' && ['check', 'cash'].includes(String(o.invoice_payment_method || '').toLowerCase()) && !!o.invoice_received_at
      ).length;

      // Debt customers count
      const { data: newDebtOrders } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('assigned_worker_id', workerId)
        .eq('status', 'delivered')
        .eq('payment_status', 'partial')
        .gte('updated_at', startTz)
        .lte('updated_at', endTz);

      const newDebtCustomers = new Set((newDebtOrders || []).map(o => o.customer_id)).size;

      // Debt collections customers count
      const { data: debtPaymentsData } = await supabase
        .from('debt_payments')
        .select('debt_id, debt:customer_debts!debt_payments_debt_id_fkey(customer_id)')
        .eq('worker_id', workerId)
        .gte('collected_at', startTz)
        .lte('collected_at', endTz);

      const collectedDebtCustomers = new Set(
        (debtPaymentsData || []).map((dp: any) => dp.debt?.customer_id).filter(Boolean)
      ).size;

      // Completed deliveries
      const completedCount = orders.length;

      // Stock verification status
      const { data: loadingSessions } = await supabase
        .from('loading_sessions')
        .select('id, status')
        .eq('worker_id', workerId)
        .gte('created_at', startTz)
        .lte('created_at', endTz)
        .order('created_at', { ascending: false })
        .limit(1);

      const truckReviewed = (loadingSessions || []).length > 0;

      return {
        checksCount,
        versementCount,
        virementCount,
        stampedTotal,
        stampedReceived,
        newDebtCustomers,
        collectedDebtCustomers,
        completedCount,
        truckReviewed,
      };
    },
  });

  if (!stats) return null;

  const totalCash = calc.physicalCash;

  return (
    <div className="border-2 border-primary/30 rounded-xl p-3.5 space-y-1 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-sm">ملخص التسليم</h3>
        <div className="h-px flex-1 bg-border" />
      </div>

      <SummaryRow
        icon={<Banknote className="w-3.5 h-3.5 text-green-600" />}
        label="إجمالي الكاش"
        value={`${fmt(totalCash)} DA`}
        color="text-green-600"
      />
      <SummaryRow
        icon={<HandCoins className="w-3.5 h-3.5 text-orange-600" />}
        label="ديون محصلة"
        value={`${fmt(calc.debtCollections.total)} DA`}
        color="text-orange-600"
        sub={`${stats.collectedDebtCustomers} عميل`}
      />
      <SummaryRow
        icon={<TrendingDown className="w-3.5 h-3.5 text-destructive" />}
        label="ديون جديدة"
        value={`${fmt(calc.newDebts)} DA`}
        color="text-destructive"
        sub={`${stats.newDebtCustomers} عميل`}
      />

      <div className="border-t my-1" />

      <SummaryRow
        icon={<FileCheck2 className="w-3.5 h-3.5 text-blue-600" />}
        label="Chèques"
        value={String(stats.checksCount)}
        color="text-blue-600"
      />
      <SummaryRow
        icon={<FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />}
        label="Versements"
        value={String(stats.versementCount)}
        color="text-emerald-600"
      />
      <SummaryRow
        icon={<FileCheck2 className="w-3.5 h-3.5 text-purple-600" />}
        label="Virements"
        value={String(stats.virementCount)}
        color="text-purple-600"
      />
      <SummaryRow
        icon={<Stamp className="w-3.5 h-3.5 text-violet-600" />}
        label="فواتير مختومة"
        value={`${stats.stampedReceived}/${stats.stampedTotal}`}
        color={stats.stampedReceived === stats.stampedTotal && stats.stampedTotal > 0 ? 'text-green-600' : 'text-destructive'}
      />

      <div className="border-t my-1" />

      <SummaryRow
        icon={<Coins className="w-3.5 h-3.5 text-amber-600" />}
        label="عملات معدنية"
        value={coinAmount > 0 ? `${fmt(coinAmount)} DA` : '—'}
        color="text-amber-600"
      />
      <SummaryRow
        icon={<Truck className="w-3.5 h-3.5 text-primary" />}
        label="مراجعة الشاحنة"
        value={stats.truckReviewed ? 'تمت ✓' : 'لم تتم'}
        color={stats.truckReviewed ? 'text-green-600' : 'text-destructive'}
      />
      <SummaryRow
        icon={<PackageCheck className="w-3.5 h-3.5 text-green-600" />}
        label="توصيلات مكتملة"
        value={String(stats.completedCount)}
        color="text-green-600"
      />
    </div>
  );
};

export default WorkerHandoverSummary;
