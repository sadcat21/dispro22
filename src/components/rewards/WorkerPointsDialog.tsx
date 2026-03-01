import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId?: string;
  workerName?: string;
}

const WorkerPointsDialog: React.FC<Props> = ({ open, onOpenChange, workerId, workerName }) => {
  const { data: logs = [] } = useQuery({
    queryKey: ['worker-points-log', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data } = await supabase.from('employee_points_log')
        .select('*, reward_tasks(name), reward_penalties(name)')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!workerId && open,
  });

  const rewards = logs.filter(l => l.point_type === 'reward');
  const penalties = logs.filter(l => l.point_type === 'penalty');
  const totalRewards = rewards.reduce((s, l) => s + l.points, 0);
  const totalPenalties = penalties.reduce((s, l) => s + l.points, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            سجل نقاط - {workerName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            مكافآت: {totalRewards} نقطة
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            عقوبات: {totalPenalties} نقطة
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            صافي: {totalRewards - totalPenalties}
          </Badge>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2">
            {logs.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">لا توجد سجلات بعد</p>
            )}
            {logs.map(log => (
              <div key={log.id} className={`p-2.5 rounded-lg border ${log.point_type === 'reward' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {log.point_type === 'reward' ? (
                      <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {log.point_type === 'reward' 
                        ? (log.reward_tasks as any)?.name || 'مكافأة'
                        : (log.reward_penalties as any)?.name || 'عقوبة'
                      }
                    </span>
                  </div>
                  <Badge variant={log.point_type === 'reward' ? 'default' : 'destructive'} className="text-xs">
                    {log.point_type === 'reward' ? '+' : '-'}{log.points}
                  </Badge>
                </div>
                {log.notes && <p className="text-[10px] text-muted-foreground mt-1">{log.notes}</p>}
                <div className="flex items-center gap-1 mt-1">
                  <Calendar className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{log.point_date}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerPointsDialog;
