import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Customer } from '@/types/database';

interface PendingRequest {
  id: string;
  operation_type: string;
  customer_id: string | null;
  payload: any;
  requested_by: string;
  requester_name?: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  requests: PendingRequest[];
  onProcessed: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'الاسم',
  name_fr: 'الاسم (فرنسي)',
  store_name: 'اسم المحل',
  store_name_fr: 'اسم المحل (فرنسي)',
  internal_name: 'الاسم الداخلي',
  phone: 'الهاتف',
  address: 'العنوان',
  wilaya: 'الولاية',
  sector_id: 'القطاع',
  zone_id: 'المنطقة',
  customer_type: 'نوع العميل',
  location_type: 'نوع الموقع',
  latitude: 'خط العرض',
  longitude: 'خط الطول',
  default_payment_type: 'نوع الدفع',
  default_price_subtype: 'فئة السعر',
  is_trusted: 'موثوق',
  trust_notes: 'ملاحظات الثقة',
  sales_rep_name: 'مندوب المبيعات',
  sales_rep_phone: 'هاتف المندوب',
  default_delivery_worker_id: 'عامل التوصيل',
  status: 'الحالة',
};

const IGNORED_FIELDS = ['new_debt_amount', 'debtAmount', 'initial_debt', 'branch_id', 'created_by', 'created_at', 'updated_at', 'id'];

const CustomerChangeReviewDialog: React.FC<Props> = ({ open, onOpenChange, customer, requests, onProcessed }) => {
  const { workerId } = useAuth();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (request: PendingRequest) => {
    setProcessingId(request.id);
    try {
      if (request.operation_type === 'update' && request.customer_id) {
        const { new_debt_amount, initial_debt, debtAmount, ...updateData } = request.payload;
        const { error: updateError } = await supabase
          .from('customers').update(updateData).eq('id', request.customer_id);
        if (updateError) throw updateError;
      } else if (request.operation_type === 'delete' && request.customer_id) {
        const { error } = await supabase
          .from('customers').delete().eq('id', request.customer_id);
        if (error) throw error;
      }

      await supabase
        .from('customer_approval_requests')
        .update({ status: 'approved', reviewed_by: workerId, reviewed_at: new Date().toISOString() })
        .eq('id', request.id);

      toast.success('تمت الموافقة على الطلب');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onProcessed();
    } catch (err: any) {
      toast.error('فشل في الموافقة: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: PendingRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('customer_approval_requests')
        .update({ status: 'rejected', reviewed_by: workerId, reviewed_at: new Date().toISOString() })
        .eq('id', request.id);

      toast.info('تم رفض الطلب');
      onProcessed();
    } catch (err: any) {
      toast.error('فشل في رفض الطلب');
    } finally {
      setProcessingId(null);
    }
  };

  const getChangedFields = (payload: any) => {
    const changes: { field: string; label: string; oldValue: any; newValue: any }[] = [];
    for (const key of Object.keys(payload)) {
      if (IGNORED_FIELDS.includes(key)) continue;
      const oldVal = (customer as any)[key];
      const newVal = payload[key];
      // Compare stringified to handle nulls/undefined
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        changes.push({
          field: key,
          label: FIELD_LABELS[key] || key,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }
    return changes;
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined || val === '') return <span className="text-muted-foreground italic">فارغ</span>;
    if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
    return String(val);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            طلبات تعديل: {customer.store_name || customer.name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-4 p-1">
            {requests.map((request) => {
              const changes = request.operation_type === 'update' ? getChangedFields(request.payload) : [];
              const isProcessing = processingId === request.id;

              return (
                <div key={request.id} className="border rounded-lg p-3 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <Badge variant={request.operation_type === 'update' ? 'outline' : 'destructive'} className="text-xs">
                      {request.operation_type === 'update' ? 'تعديل' : 'حذف'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(request.created_at).toLocaleString('ar-DZ')}
                    </span>
                  </div>

                  {request.requester_name && (
                    <p className="text-xs text-muted-foreground">بواسطة: <span className="font-medium text-foreground">{request.requester_name}</span></p>
                  )}

                  {/* Changes comparison */}
                  {request.operation_type === 'update' && changes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">التغييرات المطلوبة:</p>
                      <div className="space-y-1.5">
                        {changes.map((change) => (
                          <div key={change.field} className="bg-muted/50 rounded-md p-2 text-xs space-y-1">
                            <p className="font-semibold text-foreground">{change.label}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-destructive/10 text-destructive rounded px-2 py-1 line-through">
                                {formatValue(change.oldValue)}
                              </div>
                              <ArrowLeft className="w-3 h-3 text-muted-foreground shrink-0" />
                              <div className="flex-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded px-2 py-1 font-medium">
                                {formatValue(change.newValue)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {request.operation_type === 'update' && changes.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">لا توجد تغييرات مختلفة عن البيانات الحالية</p>
                  )}

                  {request.operation_type === 'delete' && (
                    <p className="text-xs text-destructive font-medium">⚠️ طلب حذف هذا العميل نهائياً</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApprove(request)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 ml-1" />}
                      موافقة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(request)}
                      disabled={isProcessing}
                    >
                      <X className="w-3 h-3 ml-1" />
                      رفض
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerChangeReviewDialog;
