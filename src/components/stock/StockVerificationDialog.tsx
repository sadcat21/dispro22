import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, TrendingUp, Package, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateDiscrepancy } from '@/hooks/useStockDiscrepancies';
import { toast } from 'sonner';

interface VerificationItem {
  product_id: string;
  product_name: string;
  system_qty: number;
  status: 'unverified' | 'match' | 'deficit' | 'surplus';
  discrepancy_value: number; // positive number for both deficit & surplus
}

interface StockVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  onComplete?: () => void;
}

const StockVerificationDialog: React.FC<StockVerificationDialogProps> = ({
  open, onOpenChange, workerId, onComplete,
}) => {
  const { workerId: currentWorkerId, activeBranch } = useAuth();
  const createDiscrepancy = useCreateDiscrepancy();
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !workerId) return;
    const fetchWorkerStock = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('worker_stock')
        .select('product_id, quantity, product:products(name)')
        .eq('worker_id', workerId)
        .gt('quantity', 0);
      
      setItems((data || []).map(ws => ({
        product_id: ws.product_id,
        product_name: (ws.product as any)?.name || '',
        system_qty: ws.quantity,
        status: 'unverified',
        discrepancy_value: 0,
      })));
      setIsLoading(false);
    };
    fetchWorkerStock();
  }, [open, workerId]);

  const updateItemStatus = (productId: string, status: 'match' | 'deficit' | 'surplus') => {
    setItems(prev => prev.map(item =>
      item.product_id === productId
        ? { ...item, status, discrepancy_value: status === 'match' ? 0 : item.discrepancy_value }
        : item
    ));
  };

  const updateDiscrepancyValue = (productId: string, value: number) => {
    setItems(prev => prev.map(item =>
      item.product_id === productId ? { ...item, discrepancy_value: value } : item
    ));
  };

  const handleConfirm = async () => {
    const unverified = items.filter(i => i.status === 'unverified');
    if (unverified.length > 0) {
      toast.error(`يرجى تأكيد حالة جميع المنتجات (${unverified.length} متبقي)`);
      return;
    }

    const discrepancies = items.filter(i => i.status !== 'match' && i.discrepancy_value > 0);
    if (discrepancies.some(d => d.discrepancy_value <= 0)) {
      toast.error('يرجى إدخال قيمة العجز أو الفائض');
      return;
    }

    setIsSubmitting(true);
    try {
      const branchId = activeBranch?.id;

      // Record each discrepancy
      for (const item of discrepancies) {
        await createDiscrepancy.mutateAsync({
          worker_id: workerId,
          product_id: item.product_id,
          branch_id: branchId || null,
          discrepancy_type: item.status as 'deficit' | 'surplus',
          quantity: item.discrepancy_value,
          notes: `جلسة تأكيد مخزون - ${item.status === 'deficit' ? 'عجز' : 'فائض'}: ${item.discrepancy_value}`,
        });
      }

      toast.success(`تم تأكيد المخزون - ${discrepancies.length} فارق مسجل`);
      onOpenChange(false);
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'خطأ في تسجيل التأكيد');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifiedCount = items.filter(i => i.status !== 'unverified').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            جلسة تأكيد المخزون
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            تحقق من رصيد كل منتج: مطابق، عجز، أو فائض
          </p>
          {items.length > 0 && (
            <Badge variant="outline" className="w-fit">
              {verifiedCount}/{items.length} تم التحقق
            </Badge>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              لا توجد منتجات في رصيد العامل
            </div>
          ) : (
            <div className="space-y-3 p-1">
              {items.map(item => (
                <Card key={item.product_id} className={`border ${
                  item.status === 'match' ? 'border-green-300 bg-green-50/50 dark:bg-green-900/10' :
                  item.status === 'deficit' ? 'border-destructive/40 bg-destructive/5' :
                  item.status === 'surplus' ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-900/10' :
                  ''
                }`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{item.product_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        رصيد النظام: {item.system_qty}
                      </Badge>
                    </div>

                    {/* Status buttons */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        size="sm"
                        variant={item.status === 'match' ? 'default' : 'outline'}
                        className={item.status === 'match' ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-green-600 border-green-300'}
                        onClick={() => updateItemStatus(item.product_id, 'match')}
                      >
                        <CheckCircle className="w-3.5 h-3.5 me-1" />
                        مطابق
                      </Button>
                      <Button
                        size="sm"
                        variant={item.status === 'deficit' ? 'default' : 'outline'}
                        className={item.status === 'deficit' ? 'bg-destructive hover:bg-destructive/90 text-white' : 'text-destructive border-destructive/30'}
                        onClick={() => updateItemStatus(item.product_id, 'deficit')}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 me-1" />
                        عجز
                      </Button>
                      <Button
                        size="sm"
                        variant={item.status === 'surplus' ? 'default' : 'outline'}
                        className={item.status === 'surplus' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'text-orange-600 border-orange-300'}
                        onClick={() => updateItemStatus(item.product_id, 'surplus')}
                      >
                        <TrendingUp className="w-3.5 h-3.5 me-1" />
                        فائض
                      </Button>
                    </div>

                    {/* Discrepancy value input */}
                    {(item.status === 'deficit' || item.status === 'surplus') && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.status === 'deficit' ? 'كمية العجز:' : 'كمية الفائض:'}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.discrepancy_value || ''}
                          onChange={e => updateDiscrepancyValue(item.product_id, parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          placeholder="أدخل الكمية"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin me-2" />}
            <CheckCircle className="w-4 h-4 me-1" />
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StockVerificationDialog;
