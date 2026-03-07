import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Package, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId?: string;
  workerName?: string;
}

interface GiftCustomerDetail {
  customerId: string;
  customerName: string;
  storeName: string | null;
  sectorName: string;
  giftPieces: number;
  quantitySold: number;
  date: string;
}

interface GiftProductAgg {
  productId: string;
  productName: string;
  imageUrl: string | null;
  piecesPerBox: number;
  totalGiftPieces: number;
  totalQuantitySold: number;
  offerName: string;
  customers: GiftCustomerDetail[];
}

const formatGiftDisplay = (giftPieces: number, piecesPerBox: number): string => {
  if (piecesPerBox <= 1) return `${giftPieces}`;
  const boxes = Math.floor(giftPieces / piecesPerBox);
  const remainingPieces = giftPieces % piecesPerBox;
  return `${boxes}.${String(remainingPieces).padStart(2, '0')}`;
};

const WorkerGiftsSummaryDialog: React.FC<Props> = ({ open, onOpenChange, workerId, workerName }) => {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  useRealtimeSubscription(
    `worker-gifts-realtime-${workerId}`,
    [
      { table: 'orders' },
      { table: 'order_items' },
      { table: 'promos' },
    ],
    [['worker-gifts-summary', workerId], ['worker-last-accounting-gifts', workerId]],
    open && !!workerId
  );

  const { data: lastAccounting } = useQuery({
    queryKey: ['worker-last-accounting-gifts', workerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounting_sessions')
        .select('completed_at')
        .eq('worker_id', workerId!)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      return data?.completed_at || null;
    },
    enabled: open && !!workerId,
  });

  const { data: giftsData, isLoading } = useQuery({
    queryKey: ['worker-gifts-summary', workerId, lastAccounting],
    queryFn: async () => {
      // Fetch delivered orders
      let ordersQuery = supabase
        .from('orders')
        .select('id, customer_id, updated_at, notes, customer:customers(name, store_name, sector:sectors(name))')
        .in('status', ['delivered', 'completed', 'confirmed'])
        .or(`assigned_worker_id.eq.${workerId!},created_by.eq.${workerId!}`);

      if (lastAccounting) {
        ordersQuery = ordersQuery.gte('updated_at', lastAccounting);
      }

      const { data: orders } = await ordersQuery;
      if (!orders || orders.length === 0) return { items: [], totalGifts: 0 };

      const orderIds = orders.map(o => o.id);

      // Fetch order items with gifts
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity, gift_quantity, gift_offer_id, pieces_per_box, product:products(name, pieces_per_box, image_url)')
        .in('order_id', orderIds)
        .gt('gift_quantity', 0);

      // Fetch offer names
      const giftOfferIds = new Set<string>();
      (items || []).forEach(i => { if (i.gift_offer_id) giftOfferIds.add(i.gift_offer_id); });
      let offerNamesMap: Record<string, string> = {};
      if (giftOfferIds.size > 0) {
        const { data: offers } = await supabase.from('product_offers').select('id, name').in('id', Array.from(giftOfferIds));
        (offers || []).forEach(o => { offerNamesMap[o.id] = o.name; });
      }

      const orderMap = new Map(orders.map(o => [o.id, o]));

      // Aggregate by product + offer
      const agg: Record<string, GiftProductAgg> = {};

      for (const item of (items || [])) {
        const order = orderMap.get(item.order_id) as any;
        if (!order) continue;

        const piecesPerBox = Number((item as any).pieces_per_box || (item as any).product?.pieces_per_box || 1);
        const rawGift = Number(item.gift_quantity || 0);
        const isDirectSale = String(order?.notes || '').includes('بيع مباشر');
        const giftPieces = (isDirectSale || piecesPerBox <= 1) ? rawGift : rawGift * piecesPerBox;

        const offerId = item.gift_offer_id || 'unknown';
        const key = `${item.product_id}_${offerId}`;

        if (!agg[key]) {
          agg[key] = {
            productId: item.product_id,
            productName: (item as any).product?.name || 'منتج غير معروف',
            imageUrl: (item as any).product?.image_url || null,
            piecesPerBox,
            totalGiftPieces: 0,
            totalQuantitySold: 0,
            offerName: offerNamesMap[offerId] || '',
            customers: [],
          };
        }

        const soldQty = Math.max(0, Number(item.quantity || 0) - (piecesPerBox > 0 ? giftPieces / piecesPerBox : 0));
        agg[key].totalGiftPieces += giftPieces;
        agg[key].totalQuantitySold += soldQty;

        const existing = agg[key].customers.find(c => c.customerId === order.customer_id);
        if (existing) {
          existing.giftPieces += giftPieces;
          existing.quantitySold += soldQty;
        } else {
          agg[key].customers.push({
            customerId: order.customer_id || '',
            customerName: order.customer?.name || '',
            storeName: order.customer?.store_name || null,
            sectorName: order.customer?.sector?.name || '',
            giftPieces,
            quantitySold: soldQty,
            date: order.updated_at || '',
          });
        }
      }

      // Also check promos table
      let promosQuery = supabase
        .from('promos')
        .select('product_id, vente_quantity, gratuite_quantity, notes, promo_date, customer_id, customer:customers(name, store_name, sector:sectors(name)), product:products(name, pieces_per_box, image_url)')
        .eq('worker_id', workerId!)
        .gt('gratuite_quantity', 0);
      if (lastAccounting) {
        promosQuery = promosQuery.gte('promo_date', lastAccounting);
      }
      const { data: promosData } = await promosQuery;

      // Get offer units for promo products
      const promoProductIds = [...new Set((promosData || []).map(p => p.product_id))];
      let offerUnitMap: Record<string, string> = {};
      if (promoProductIds.length > 0) {
        const { data: productOffers } = await supabase
          .from('product_offers')
          .select('id, product_id, gift_quantity_unit')
          .in('product_id', promoProductIds)
          .eq('is_active', true);
        (productOffers || []).forEach(o => { offerUnitMap[o.product_id] = o.gift_quantity_unit || 'piece'; });
      }

      // Track order_items gifts by product to avoid double counting
      const orderGiftsByProduct: Record<string, number> = {};
      Object.values(agg).forEach(p => {
        orderGiftsByProduct[p.productId] = (orderGiftsByProduct[p.productId] || 0) + p.totalGiftPieces;
      });

      // Aggregate promos by product
      const promosByProduct: Record<string, { totalGiftPieces: number; totalVente: number; product: any; customers: GiftCustomerDetail[] }> = {};
      for (const promo of (promosData || [])) {
        const giftQty = Number(promo.gratuite_quantity || 0);
        if (giftQty <= 0) continue;
        const piecesPerBox = Number((promo.product as any)?.pieces_per_box || 1);
        const giftUnit = offerUnitMap[promo.product_id] || 'piece';
        const isDirectSalePromo = String(promo?.notes || '').includes('بيع مباشر');
        const giftInPieces = (isDirectSalePromo || piecesPerBox <= 1) ? giftQty : (giftUnit === 'box' ? giftQty * piecesPerBox : giftQty);

        if (!promosByProduct[promo.product_id]) {
          promosByProduct[promo.product_id] = { totalGiftPieces: 0, totalVente: 0, product: promo.product, customers: [] };
        }
        promosByProduct[promo.product_id].totalGiftPieces += giftInPieces;
        promosByProduct[promo.product_id].totalVente += Number(promo.vente_quantity || 0);
        promosByProduct[promo.product_id].customers.push({
          customerId: (promo as any).customer_id || '',
          customerName: (promo as any).customer?.name || '',
          storeName: (promo as any).customer?.store_name || null,
          sectorName: (promo as any).customer?.sector?.name || '',
          giftPieces: giftInPieces,
          quantitySold: Number(promo.vente_quantity || 0),
          date: (promo as any).promo_date || '',
        });
      }

      // Add promos not covered by order_items
      for (const [productId, promoAgg] of Object.entries(promosByProduct)) {
        const alreadyTracked = orderGiftsByProduct[productId] || 0;
        const extra = promoAgg.totalGiftPieces - alreadyTracked;
        if (extra <= 0) continue;
        const product = promoAgg.product as any;
        const key = `${productId}_promo`;
        agg[key] = {
          productId,
          productName: product?.name || '',
          imageUrl: product?.image_url || null,
          piecesPerBox: Number(product?.pieces_per_box || 1),
          totalGiftPieces: extra,
          totalQuantitySold: promoAgg.totalVente,
          offerName: 'عرض ترويجي',
          customers: promoAgg.customers,
        };
      }

      const sorted = Object.values(agg).sort((a, b) => b.totalGiftPieces - a.totalGiftPieces);
      const totalGifts = sorted.reduce((s, i) => s + i.totalGiftPieces, 0);

      return { items: sorted, totalGifts };
    },
    enabled: open && !!workerId,
    refetchInterval: open ? 15000 : false,
  });

  const todayDate = new Date().toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" />
              تجميع الهدايا - {workerName}
            </div>
            <div className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{todayDate}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 items-center text-xs">
          <Badge variant="secondary" className="text-xs">
            {giftsData?.items?.length || 0} منتج
          </Badge>
          <Badge className="text-xs bg-purple-100 text-purple-700 border-0">
            🎁 {giftsData?.totalGifts || 0} قطعة هدايا
          </Badge>
          {lastAccounting && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              منذ آخر محاسبة
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !giftsData?.items?.length ? (
            <div className="py-10 text-center text-muted-foreground">
              <Gift className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>لا توجد هدايا في هذه الفترة</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 pb-2">
              {giftsData.items.map((item) => {
                const isExpanded = expandedProduct === item.productId + '_' + item.offerName;
                const toggleKey = item.productId + '_' + item.offerName;

                return (
                  <Collapsible
                    key={toggleKey}
                    open={isExpanded}
                    onOpenChange={(val) => setExpandedProduct(val ? toggleKey : null)}
                    className="col-span-3"
                  >
                    <div className="flex flex-col rounded-2xl overflow-hidden shadow-lg border-2 border-border hover:border-purple-400/50 transition-all">
                      <CollapsibleTrigger className="w-full text-start">
                        <div className="flex items-center gap-3 p-3">
                          {/* Product image */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-primary/30" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{item.productName}</p>
                            {item.offerName && (
                              <p className="text-[10px] text-muted-foreground truncate">{item.offerName}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-bold text-purple-600">
                                🎁 {formatGiftDisplay(item.totalGiftPieces, item.piecesPerBox)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({item.totalGiftPieces} قطعة)
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                • {item.customers.length} عميل
                              </span>
                            </div>
                          </div>

                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t bg-accent/30 p-2 space-y-1">
                          <div className="grid grid-cols-12 gap-1 text-[9px] text-muted-foreground font-medium px-1 py-1 border-b border-border/50">
                            <span className="col-span-5">العميل</span>
                            <span className="col-span-2 text-center">المبيعات</span>
                            <span className="col-span-3 text-center">الهدية</span>
                            <span className="col-span-2 text-end">التاريخ</span>
                          </div>
                          {item.customers.map((c, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-1 text-[11px] px-1 py-1.5 border-b border-dashed border-border/30 last:border-0 items-center">
                              <div className="col-span-5 flex items-center gap-1 min-w-0">
                                <User className="w-3 h-3 text-muted-foreground shrink-0" />
                                <div className="truncate">
                                  {c.sectorName && (
                                    <span className="text-[9px] text-primary font-medium block">{c.sectorName}</span>
                                  )}
                                  <span className="font-bold text-[11px]">{c.storeName || c.customerName || '-'}</span>
                                </div>
                              </div>
                              <span className="col-span-2 text-center font-semibold">{Math.round(c.quantitySold * 100) / 100}</span>
                              <div className="col-span-3 text-center">
                                <span className="font-semibold text-purple-600">
                                  {formatGiftDisplay(c.giftPieces, item.piecesPerBox)}
                                </span>
                                <div className="text-[8px] text-muted-foreground">
                                  {c.giftPieces} قطعة
                                </div>
                              </div>
                              <div className="col-span-2 text-end text-[9px] text-muted-foreground">
                                {c.date ? new Date(c.date).toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' }) : '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerGiftsSummaryDialog;
