import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, HardHat, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Worker {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

const SupervisorWorkersSection: React.FC = () => {
  const { activeBranch, workerId: currentWorkerId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [assignedWorkers, setAssignedWorkers] = useState<Set<string>>(new Set());

  // Fetch all workers
  const { data: allWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ['all-workers-for-supervisor', activeBranch?.id],
    queryFn: async () => {
      let query = supabase.from('workers').select('id, full_name, role, is_active').eq('is_active', true).order('full_name');
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { data } = await query;
      return (data || []) as Worker[];
    },
  });

  // Separate supervisors and regular workers
  const supervisors = useMemo(() => allWorkers.filter(w => w.role === 'supervisor'), [allWorkers]);
  const regularWorkers = useMemo(() => allWorkers.filter(w => w.role === 'worker'), [allWorkers]);

  // Fetch current assignments for selected supervisor
  const { data: currentAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['supervisor-assignments', selectedSupervisor],
    queryFn: async () => {
      const { data } = await supabase
        .from('supervisor_workers')
        .select('worker_id')
        .eq('supervisor_id', selectedSupervisor!);
      return (data || []).map(d => d.worker_id);
    },
    enabled: !!selectedSupervisor,
  });

  // Sync state when assignments load
  React.useEffect(() => {
    if (currentAssignments) {
      setAssignedWorkers(new Set(currentAssignments));
    }
  }, [currentAssignments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSupervisor) return;
      // Delete all existing
      await supabase.from('supervisor_workers').delete().eq('supervisor_id', selectedSupervisor);
      // Insert new
      if (assignedWorkers.size > 0) {
        const rows = Array.from(assignedWorkers).map(wId => ({
          supervisor_id: selectedSupervisor,
          worker_id: wId,
          created_by: currentWorkerId,
        }));
        const { error } = await supabase.from('supervisor_workers').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-assignments'] });
      toast.success('تم حفظ تعيينات المشرف بنجاح');
    },
    onError: () => {
      toast.error('فشل حفظ التعيينات');
    },
  });

  const toggleWorker = (workerId: string) => {
    setAssignedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setAssignedWorkers(new Set(regularWorkers.map(w => w.id)));
  };

  const deselectAll = () => {
    setAssignedWorkers(new Set());
  };

  if (workersLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (supervisors.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <HardHat className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>لا يوجد مشرفون. أضف عاملاً بدور "مشرف" أولاً.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">تعيين العمال للمشرفين</h3>
      </div>
      <p className="text-sm text-muted-foreground">حدد المشرف ثم اختر العمال الذين يمكنه متابعتهم في صفحة إجراءات العمال.</p>

      {/* Supervisor picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {supervisors.map(sup => (
          <button
            key={sup.id}
            onClick={() => setSelectedSupervisor(sup.id)}
            className={`p-3 rounded-xl border-2 text-center transition-all ${
              selectedSupervisor === sup.id
                ? 'border-primary bg-primary/10 text-primary font-bold'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <HardHat className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs font-medium">{sup.full_name}</span>
          </button>
        ))}
      </div>

      {/* Worker selection */}
      {selectedSupervisor && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{assignedWorkers.size} عامل محدد</Badge>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAll}>تحديد الكل</Button>
              <Button size="sm" variant="outline" onClick={deselectAll}>إلغاء الكل</Button>
            </div>
          </div>

          {assignmentsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-2 max-h-[50vh] overflow-y-auto">
              {regularWorkers.map(worker => (
                <label
                  key={worker.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={assignedWorkers.has(worker.id)}
                    onCheckedChange={() => toggleWorker(worker.id)}
                  />
                  <span className="text-sm font-medium">{worker.full_name}</span>
                </label>
              ))}
            </div>
          )}

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ التعيينات
          </Button>
        </div>
      )}
    </div>
  );
};

export default SupervisorWorkersSection;
