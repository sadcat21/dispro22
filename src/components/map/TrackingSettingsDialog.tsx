import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, User, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface TrackingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Hook to get/set trackable workers
export const useTrackableWorkers = () => {
  return useQuery({
    queryKey: ['trackable-worker-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'trackable_worker_ids')
        .maybeSingle();

      if (error) throw error;
      // If no setting exists, all workers are trackable (return null = all)
      if (!data) return null;
      try {
        return JSON.parse(data.value) as string[];
      } catch {
        return null;
      }
    },
  });
};

const TrackingSettingsDialog: React.FC<TrackingSettingsDialogProps> = ({ open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(true);

  // Get all workers
  const { data: workers, isLoading: loadingWorkers } = useQuery({
    queryKey: ['all-workers-for-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers_safe')
        .select('id, full_name')
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Get current setting
  const { data: currentIds, isLoading: loadingSetting } = useTrackableWorkers();

  useEffect(() => {
    if (!open || !workers) return;
    if (currentIds === null) {
      // All workers selected
      setAllSelected(true);
      setSelectedIds(new Set(workers.map(w => w.id)));
    } else {
      setAllSelected(false);
      setSelectedIds(new Set(currentIds));
    }
  }, [open, workers, currentIds]);

  const saveMutation = useMutation({
    mutationFn: async (ids: string[] | null) => {
      if (ids === null) {
        // Delete the setting = all workers
        await supabase
          .from('app_settings')
          .delete()
          .eq('key', 'trackable_worker_ids');
      } else {
        const value = JSON.stringify(ids);
        const { data: existing } = await supabase
          .from('app_settings')
          .select('id')
          .eq('key', 'trackable_worker_ids')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('app_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', 'trackable_worker_ids');
        } else {
          await supabase
            .from('app_settings')
            .insert({ key: 'trackable_worker_ids', value });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackable-worker-ids'] });
      queryClient.invalidateQueries({ queryKey: ['worker-locations'] });
      toast.success('تم حفظ الإعدادات');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('خطأ في حفظ الإعدادات');
    },
  });

  const toggleWorker = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    setAllSelected(workers ? next.size === workers.length : false);
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      setAllSelected(false);
    } else {
      setSelectedIds(new Set(workers?.map(w => w.id) || []));
      setAllSelected(true);
    }
  };

  const handleSave = () => {
    if (allSelected || (workers && selectedIds.size === workers.length)) {
      saveMutation.mutate(null);
    } else {
      saveMutation.mutate(Array.from(selectedIds));
    }
  };

  const isLoading = loadingWorkers || loadingSetting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            إعدادات التتبع
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <span className="font-medium text-sm">تحديد الكل</span>
              <Switch checked={allSelected} onCheckedChange={toggleAll} />
            </div>

            {/* Workers list */}
            <div className="max-h-[50vh] overflow-y-auto space-y-1">
              {workers?.map(w => {
                const checked = selectedIds.has(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWorker(w.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors
                      ${checked ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent border border-transparent'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{w.full_name}</span>
                    </div>
                    {checked && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} / {workers?.length || 0} عامل
              </span>
              <Button onClick={handleSave} disabled={saveMutation.isPending || selectedIds.size === 0}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TrackingSettingsDialog;
