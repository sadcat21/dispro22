import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useReceipts, useUpdateReceiptPrintCount } from '@/hooks/useReceipts';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { formatReceiptForPreview, ReceiptData } from '@/services/receiptFormatter';
import { ReceiptWithDetails, ReceiptItem } from '@/types/receipt';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Printer, Search, Filter, Eye, Calendar, User, Receipt,
  Bluetooth, Loader2, FileText, Truck, CreditCard, RefreshCw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DailyReceipts: React.FC = () => {
  const { role, workerId, activeBranch } = useAuth();
  const { dir, t } = useLanguage();
  const isAdmin = role === 'admin' || role === 'branch_admin';
  const { isConnected, scanAndConnect, printReceipt, status } = useBluetoothPrinter();
  const updatePrintCount = useUpdateReceiptPrintCount();

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterWorkerId, setFilterWorkerId] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewReceipt, setPreviewReceipt] = useState<ReceiptWithDetails | null>(null);

  // Workers list for filter
  const { data: workers } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const query = supabase.from('workers').select('id, full_name').eq('is_active', true);
      const { data } = await query;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: receipts, isLoading } = useReceipts({
    date: selectedDate,
    workerId: isAdmin ? (filterWorkerId || undefined) : workerId || undefined,
    receiptType: filterType !== 'all' ? filterType : undefined,
  });

  const filteredReceipts = useMemo(() => {
    if (!receipts) return [];
    if (!searchQuery) return receipts;
    const q = searchQuery.toLowerCase();
    return receipts.filter(r =>
      r.customer_name.toLowerCase().includes(q) ||
      String(r.receipt_number).includes(q)
    );
  }, [receipts, searchQuery]);

  const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    direct_sale: { label: 'بيع مباشر', icon: Receipt, color: 'bg-green-100 text-green-800' },
    delivery: { label: 'توصيل', icon: Truck, color: 'bg-blue-100 text-blue-800' },
    debt_payment: { label: 'تسديد دين', icon: CreditCard, color: 'bg-amber-100 text-amber-800' },
  };

  const handleReprint = async (receipt: ReceiptWithDetails) => {
    const data: ReceiptData = {
      receiptNumber: receipt.receipt_number,
      receiptType: receipt.receipt_type as any,
      customerName: receipt.customer_name,
      customerPhone: receipt.customer_phone,
      workerName: receipt.worker_name,
      workerPhone: receipt.worker_phone,
      items: (receipt.items || []) as ReceiptItem[],
      totalAmount: receipt.total_amount,
      discountAmount: receipt.discount_amount,
      paidAmount: receipt.paid_amount,
      remainingAmount: receipt.remaining_amount,
      paymentMethod: receipt.payment_method,
      notes: receipt.notes,
      date: new Date(receipt.created_at),
      printCount: receipt.print_count,
    };
    const printed = await printReceipt(data);
    if (printed) {
      await updatePrintCount.mutateAsync(receipt.id);
    }
  };

  const totalAmount = filteredReceipts.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalPaid = filteredReceipts.reduce((s, r) => s + Number(r.paid_amount), 0);

  return (
    <div className="space-y-4" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          الفواتير اليومية
        </h1>
        <div className="flex items-center gap-2">
          {!isConnected ? (
            <Button size="sm" variant="outline" onClick={scanAndConnect} disabled={status === 'connecting'}>
              <Bluetooth className="w-4 h-4 ml-1" />
              طابعة
            </Button>
          ) : (
            <Badge variant="outline" className="bg-green-100 text-green-800 gap-1">
              <Printer className="w-3 h-3" /> متصل
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-9 text-sm w-auto"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 text-sm w-auto min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="direct_sale">بيع مباشر</SelectItem>
              <SelectItem value="delivery">توصيل</SelectItem>
              <SelectItem value="debt_payment">تسديد دين</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isAdmin && (
          <Select value={filterWorkerId} onValueChange={setFilterWorkerId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="كل العمال" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">كل العمال</SelectItem>
              {workers?.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم الوصل..."
            className="h-9 text-sm pr-9"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-2 text-center">
          <p className="text-xs text-muted-foreground">العدد</p>
          <p className="text-lg font-bold">{filteredReceipts.length}</p>
        </Card>
        <Card className="p-2 text-center">
          <p className="text-xs text-muted-foreground">الإجمالي</p>
          <p className="text-lg font-bold">{totalAmount.toLocaleString()}</p>
        </Card>
        <Card className="p-2 text-center">
          <p className="text-xs text-muted-foreground">المحصل</p>
          <p className="text-lg font-bold text-green-600">{totalPaid.toLocaleString()}</p>
        </Card>
      </div>

      {/* Receipts List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>لا توجد فواتير</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReceipts.map(receipt => {
            const typeInfo = typeLabels[receipt.receipt_type] || typeLabels.delivery;
            const TIcon = typeInfo.icon;
            return (
              <Card key={receipt.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">#{receipt.receipt_number}</span>
                      <Badge variant="outline" className={`text-[10px] ${typeInfo.color}`}>
                        <TIcon className="w-3 h-3 ml-0.5" />
                        {typeInfo.label}
                      </Badge>
                      {receipt.is_modified && (
                        <Badge variant="outline" className="text-[10px] bg-orange-100 text-orange-800">معدل</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{receipt.customer_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{Number(receipt.total_amount).toLocaleString()} DA</span>
                      {Number(receipt.remaining_amount) > 0 && (
                        <span className="text-destructive">متبقي: {Number(receipt.remaining_amount).toLocaleString()}</span>
                      )}
                      {isAdmin && receipt.worker?.full_name && (
                        <span className="flex items-center gap-0.5">
                          <User className="w-3 h-3" />{receipt.worker.full_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(receipt.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}</span>
                      {receipt.print_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Printer className="w-2.5 h-2.5" />
                          طُبع {receipt.print_count}×
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setPreviewReceipt(receipt)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleReprint(receipt)}
                      disabled={!isConnected}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      {previewReceipt && (
        <Dialog open={!!previewReceipt} onOpenChange={() => setPreviewReceipt(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-sm max-h-[85vh] p-0 gap-0" dir={dir}>
            <DialogHeader className="p-3 border-b">
              <DialogTitle className="text-sm">وصل #{previewReceipt.receipt_number}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] p-3">
              <div
                className="bg-white text-black rounded border p-3 text-xs"
                dangerouslySetInnerHTML={{
                  __html: formatReceiptForPreview({
                    receiptNumber: previewReceipt.receipt_number,
                    receiptType: previewReceipt.receipt_type as any,
                    customerName: previewReceipt.customer_name,
                    customerPhone: previewReceipt.customer_phone,
                    workerName: previewReceipt.worker_name,
                    workerPhone: previewReceipt.worker_phone,
                    items: (previewReceipt.items || []) as ReceiptItem[],
                    totalAmount: previewReceipt.total_amount,
                    discountAmount: previewReceipt.discount_amount,
                    paidAmount: previewReceipt.paid_amount,
                    remainingAmount: previewReceipt.remaining_amount,
                    paymentMethod: previewReceipt.payment_method,
                    notes: previewReceipt.notes,
                    date: new Date(previewReceipt.created_at),
                    printCount: previewReceipt.print_count,
                  })
                }}
              />
            </ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Button
                className="flex-1"
                size="sm"
                onClick={() => {
                  handleReprint(previewReceipt);
                  setPreviewReceipt(null);
                }}
                disabled={!isConnected}
              >
                <Printer className="w-4 h-4 ml-1" />
                إعادة طباعة
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DailyReceipts;
