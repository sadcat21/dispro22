import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveStampTiers, calculateStampAmount } from '@/hooks/useStampTiers';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins } from 'lucide-react';
import { format } from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProcessedOrder {
  id: string;
  total_amount: number;
  items_subtotal: number;
  stamp_amount: number;
  stamp_percentage: number;
  created_at: string;
}

interface CustomerGroup {
  customer_id: string;
  customer_name: string;
  store_name: string | null;
  orders: ProcessedOrder[];
  total: number;
  totalStamp: number;
}

const StampDetailsDialog = ({ open, onOpenChange }: Props) => {
  const { activeBranch } = useAuth();
  const { t, language, dir } = useLanguage();
  const { data: stampTiers } = useActiveStampTiers();
  const dateLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;
  const cur = t('treasury.currency');

  const { data: customerGroups, isLoading } = useQuery({
    queryKey: ['stamp-details', activeBranch?.id, stampTiers?.length],
    enabled: open && !!stampTiers?.length,
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('id, total_amount, created_at, customer_id, customer:customers(name, store_name), order_items(total_price)')
        .eq('status', 'delivered')
        .eq('payment_type', 'with_invoice')
        .eq('invoice_payment_method', 'cash')
        .order('created_at', { ascending: false });

      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);

      const { data, error } = await query;
      if (error) throw error;

      const groupMap = new Map<string, CustomerGroup>();

      (data || []).forEach((o: any) => {
        const customerId = o.customer_id;
        const customer = o.customer as any;
        const totalAmount = Number(o.total_amount || 0);
        const itemsSubtotal = (o.order_items || []).reduce((s: number, i: any) => s + Number(i.total_price || 0), 0);

        const baseAmount = itemsSubtotal > 0 ? itemsSubtotal : totalAmount;
        const stampAmount = calculateStampAmount(baseAmount, stampTiers!);
        const activeTiers = stampTiers!.filter(t => t.is_active);
        const matchedTier = activeTiers.find(t => baseAmount >= t.min_amount && (t.max_amount === null || baseAmount <= t.max_amount));
        const stampPercentage = matchedTier?.percentage || 0;

        if (stampAmount <= 0) return;

        const processedOrder: ProcessedOrder = {
          id: o.id,
          total_amount: totalAmount,
          items_subtotal: itemsSubtotal,
          stamp_amount: stampAmount,
          stamp_percentage: stampPercentage,
          created_at: o.created_at,
        };

        if (!groupMap.has(customerId)) {
          groupMap.set(customerId, {
            customer_id: customerId,
            customer_name: customer?.name || t('common.unknown'),
            store_name: customer?.store_name || null,
            orders: [],
            total: 0,
            totalStamp: 0,
          });
        }

        const group = groupMap.get(customerId)!;
        group.orders.push(processedOrder);
        group.total += totalAmount;
        group.totalStamp += stampAmount;
      });

      return Array.from(groupMap.values()).sort((a, b) => b.totalStamp - a.totalStamp);
    },
  });

  const grandTotal = (customerGroups || []).reduce((s, g) => s + g.total, 0);
  const grandStamp = (customerGroups || []).reduce((s, g) => s + g.totalStamp, 0);
  const totalOrders = (customerGroups || []).reduce((s, g) => s + g.orders.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-600" />
            {t('treasury.stamp_total')}
            <Badge variant="secondary" className="ms-auto">{totalOrders} - {customerGroups?.length || 0}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center mb-2">
          <p className="text-xs text-muted-foreground">{t('treasury.stamp_total')}</p>
          <p className="text-xl font-bold text-amber-600">{grandStamp.toLocaleString()} {cur}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{t('treasury.total')}: {grandTotal.toLocaleString()} {cur}</p>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">{t('common.loading')}</p>
        ) : !customerGroups || customerGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t('treasury.no_entries')}</p>
        ) : (
          <div className="space-y-3">
            {customerGroups.map((group) => (
              <Card key={group.customer_id}>
                <CardContent className="p-3">
                  {/* Customer header */}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm">{group.customer_name}</p>
                      {group.store_name && <p className="text-xs text-muted-foreground">{group.store_name}</p>}
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-amber-600">{group.totalStamp.toLocaleString()} {cur}</p>
                      <p className="text-[10px] text-muted-foreground">{t('treasury.total')}: {group.total.toLocaleString()} {cur}</p>
                      {group.orders.length > 1 && (
                        <Badge variant="outline" className="text-[10px] mt-1">{group.orders.length}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Orders table */}
                  <div className="border-t pt-2 space-y-1.5">
                    {group.orders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between text-xs bg-muted/30 rounded p-2">
                        <div>
                          <p className="text-muted-foreground">
                            {format(new Date(order.created_at), 'dd/MM HH:mm', { locale: dateLocale })}
                          </p>
                          <p className="font-medium">{order.total_amount.toLocaleString()} {cur}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-amber-600 font-medium">{order.stamp_amount.toLocaleString()} {cur}</p>
                          <p className="text-[10px] text-muted-foreground">{order.stamp_percentage}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StampDetailsDialog;
