import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Check, X, Clock } from 'lucide-react';
import { useAllDisputes, useReviewDispute } from '@/hooks/useRewardDisputes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const statusMap: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  pending: { label: 'قيد المراجعة', variant: 'secondary' },
  approved: { label: 'مقبول', variant: 'default' },
  rejected: { label: 'مرفوض', variant: 'destructive' },
};

const RewardDisputesTab: React.FC = () => {
  const { data: disputes, isLoading } = useAllDisputes();
  const reviewDispute = useReviewDispute();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: workers } = useQuery({
    queryKey: ['workers-names-disputes'],
    queryFn: async () => {
      const { data } = await supabase.from('workers').select('id, full_name');
      return data || [];
    },
  });

  const getWorkerName = (id: string) => workers?.find(w => w.id === id)?.full_name || 'موظف';

  const handleReview = (status: 'approved' | 'rejected') => {
    if (!selectedId) return;
    reviewDispute.mutate({ id: selectedId, status, review_notes: reviewNotes }, {
      onSuccess: () => { setSelectedId(null); setReviewNotes(''); },
    });
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">اعتراضات الموظفين</h3>
        {disputes && disputes.length > 0 && (
          <Badge variant="destructive" className="text-xs">{disputes.length}</Badge>
        )}
      </div>

      {(!disputes || disputes.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد اعتراضات معلقة</p>
        </div>
      ) : (
        disputes.map(d => (
          <Card key={d.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedId(d.id)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm">{getWorkerName(d.worker_id)}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.reason}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={statusMap[d.status]?.variant || 'outline'} className="text-[10px]">
                      {statusMap[d.status]?.label || d.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString('ar-DZ')}
                    </span>
                  </div>
                </div>
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>مراجعة الاعتراض</DialogTitle></DialogHeader>
          {selectedId && (() => {
            const d = disputes?.find(x => x.id === selectedId);
            if (!d) return null;
            return (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">الموظف</Label>
                  <p className="font-medium text-sm">{getWorkerName(d.worker_id)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">سبب الاعتراض</Label>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg mt-1">{d.reason}</p>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات المراجعة</Label>
                  <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="أضف ملاحظة..." />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleReview('approved')} className="flex-1" disabled={reviewDispute.isPending}>
                    <Check className="w-4 h-4 ml-1" /> قبول
                  </Button>
                  <Button onClick={() => handleReview('rejected')} variant="destructive" className="flex-1" disabled={reviewDispute.isPending}>
                    <X className="w-4 h-4 ml-1" /> رفض
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RewardDisputesTab;
