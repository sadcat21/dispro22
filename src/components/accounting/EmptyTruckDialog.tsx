import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, PackageX, Truck, Warehouse } from 'lucide-react';

interface EmptyTruckItem {
  id: string;
  product_id: string;
  product_name: string;
  currentQty: number; // ما في الشاحنة حالياً
  returnQty: number;  // الكمية المراد إرجاعها للمخزن
}

interface EmptyTruckDialogProps {
  workerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmptyTruckDialog: React.FC<EmptyTruckDialogProps> = ({ workerId, open, onOpenChange }) => {
  const { t } = useLanguage();
  const { workerId: currentWorkerId, activeBranch } = useAuth();
  const queryClient = useQueryClient();
  const branchId = activeBranch?.id;

  const [isLoading, setIsLoading] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  const [items, setItems] = useState<EmptyTruckItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadWorkerStock = async () => {
    if (!workerId || !branchId || !currentWorkerId) return;
    setIsLoading(true);

    const { data: workerStock } = await supabase
      .from('worker_stock')
      .select('id, product_id, quantity, product:products(name)')
      .eq('worker_id', workerId)
      .gt('quantity', 0);

    if (!workerStock || workerStock.length === 0) {
      toast.error(t('stock.empty_truck_nothing'));
      setIsLoading(false);
      onOpenChange(false);
      return;
    }

    const mapped: EmptyTruckItem[] = workerStock.map(ws => ({
      id: ws.id,
      product_id: ws.product_id,
      product_name: (ws.product as any)?.name || ws.product_id,
      currentQty: ws.quantity,
      returnQty: ws.quantity, // افتراضياً: تفريغ كلي
    }));

    setItems(mapped);
    setLoaded(true);
    setIsLoading(false);
  };

  React.useEffect(() => {
    if (open && !loaded) {
      loadWorkerStock();
    }
    if (!open) {
      setLoaded(false);
      setItems([]);
    }
  }, [open]);

  // تفريغ كلي - إرجاع كل الكميات
  const setFullUnload = () => {
    setItems(prev => prev.map(it => ({ ...it, returnQty: it.currentQty })));
  };

  // تصفير الكل
  const setZeroUnload = () => {
    setItems(prev => prev.map(it => ({ ...it, returnQty: 0 })));
  };

  const handleConfirm = async () => {
    if (!branchId || !currentWorkerId) return;
    setIsEmptying(true);

    try {
      const itemsToReturn = items.filter(it => it.returnQty > 0);
      if (itemsToReturn.length === 0) {
        toast.error('لم يتم تحديد أي كمية للإرجاع');
        setIsEmptying(false);
        return;
      }

      const isFullUnload = itemsToReturn.every(it => it.returnQty === it.currentQty) && itemsToReturn.length === items.length;

      const unloadingDetails = itemsToReturn.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        system_qty: item.currentQty,
        return_qty: item.returnQty,
        remaining_qty: item.currentQty - item.returnQty,
      }));

      // إنشاء جلسة تفريغ
      const { data: unloadSession, error: sessionError } = await supabase
        .from('loading_sessions')
        .insert({
          worker_id: workerId,
          manager_id: currentWorkerId,
          branch_id: branchId,
          status: 'unloaded',
          notes: isFullUnload ? 'تفريغ كلي للشاحنة' : 'تفريغ جزئي للشاحنة',
          completed_at: new Date().toISOString(),
          unloading_details: unloadingDetails,
        } as any)
        .select()
        .single();

      if (sessionError) throw sessionError;

      // جلب مخزون المستودع
      const { data: warehouseStock } = await supabase
        .from('warehouse_stock')
        .select('id, product_id, quantity')
        .eq('branch_id', branchId);

      for (const item of itemsToReturn) {
        // تسجيل عنصر الجلسة
        await supabase.from('loading_session_items').insert({
          session_id: unloadSession.id,
          product_id: item.product_id,
          quantity: item.returnQty,
          gift_quantity: 0,
          surplus_quantity: 0,
          previous_quantity: item.currentQty,
          notes: `تفريغ ${item.returnQty} من ${item.currentQty} - متبقي: ${item.currentQty - item.returnQty}`,
        });

        // خصم من رصيد العامل
        const newWorkerQty = Math.max(0, item.currentQty - item.returnQty);
        await supabase
          .from('worker_stock')
          .update({ quantity: newWorkerQty })
          .eq('id', item.id);

        // إضافة للمستودع
        const existingWh = warehouseStock?.find(s => s.product_id === item.product_id);
        if (existingWh) {
          await supabase
            .from('warehouse_stock')
            .update({ quantity: existingWh.quantity + item.returnQty })
            .eq('id', existingWh.id);
        } else {
          await supabase.from('warehouse_stock').insert({
            branch_id: branchId,
            product_id: item.product_id,
            quantity: item.returnQty,
          });
        }

        // تسجيل الحركة
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          branch_id: branchId,
          quantity: item.returnQty,
          movement_type: 'return',
          status: 'approved',
          created_by: currentWorkerId,
          worker_id: workerId,
          notes: `تفريغ ${item.returnQty} من ${item.product_name} (كان ${item.currentQty}، متبقي ${newWorkerQty})`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock', workerId] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['sold-products-summary'] });
      queryClient.invalidateQueries({ queryKey: ['loading-sessions'] });
      toast.success(t('stock.empty_truck_success'));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsEmptying(false);
    }
  };

  const totalReturn = items.reduce((s, it) => s + it.returnQty, 0);
  const totalRemaining = items.reduce((s, it) => s + (it.currentQty - it.returnQty), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="w-5 h-5 text-destructive" />
            {t('stock.empty_truck')}
          </DialogTitle>
          <DialogDescription>حدد الكمية المراد إرجاعها لكل منتج. الباقي يبقى في الشاحنة.</DialogDescription>
        </DialogHeader>

        {/* أزرار سريعة */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={setFullUnload}>
            تفريغ كلي
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={setZeroUnload}>
            تصفير الكل
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {items.map((item, idx) => {
                const remaining = item.currentQty - item.returnQty;
                return (
                  <Card key={item.product_id} className="border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{item.product_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          <Truck className="w-3 h-3 ml-1" />
                          {item.currentQty}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Warehouse className="w-3 h-3" />
                            إرجاع للمخزن
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={item.currentQty}
                            value={item.returnQty}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), item.currentQty);
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: val } : it));
                            }}
                            className="text-center h-8"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            يبقى في الشاحنة
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={item.currentQty}
                            value={remaining}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const keepVal = Math.min(Math.max(0, parseFloat(e.target.value) || 0), item.currentQty);
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: item.currentQty - keepVal } : it));
                            }}
                            className="text-center h-8"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ملخص */}
            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-md p-2 gap-3">
              <div className="flex items-center gap-1">
                <Warehouse className="w-4 h-4 text-destructive" />
                <span>إرجاع: <strong>{totalReturn}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <Truck className="w-4 h-4 text-primary" />
                <span>يبقى: <strong>{totalRemaining}</strong></span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={isEmptying || totalReturn === 0}
              >
                {isEmptying && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {t('stock.confirm_return')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmptyTruckDialog;
