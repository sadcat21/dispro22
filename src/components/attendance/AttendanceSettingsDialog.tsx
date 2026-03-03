import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Settings2, MapPin, Ruler, Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AttendanceSettingsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { activeBranch, workerId } = useAuth();
  const queryClient = useQueryClient();

  const [maxDistance, setMaxDistance] = useState('50');
  const [warehouseLat, setWarehouseLat] = useState('');
  const [warehouseLng, setWarehouseLng] = useState('');
  const [workStartTime, setWorkStartTime] = useState('08:00');

  const branchId = activeBranch?.id || null;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['attendance-settings', branchId],
    queryFn: async () => {
      const keys = ['warehouse_latitude', 'warehouse_longitude', 'attendance_max_distance', 'work_start_time'];
      
      // Try branch-specific first
      let { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', keys)
        .eq('branch_id', branchId || '');
      
      // Fallback to global
      if (!data || data.length === 0) {
        const res = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', keys)
          .is('branch_id', null);
        data = res.data;
      }

      const map: Record<string, string> = {};
      data?.forEach(d => { map[d.key] = d.value; });
      return map;
    },
    enabled: open,
  });

  useEffect(() => {
    if (settings) {
      setWarehouseLat(settings['warehouse_latitude'] || '');
      setWarehouseLng(settings['warehouse_longitude'] || '');
      setMaxDistance(settings['attendance_max_distance'] || '50');
      setWorkStartTime(settings['work_start_time'] || '08:00');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = [
        { key: 'warehouse_latitude', value: warehouseLat },
        { key: 'warehouse_longitude', value: warehouseLng },
        { key: 'attendance_max_distance', value: maxDistance },
        { key: 'work_start_time', value: workStartTime },
      ];

      for (const entry of entries) {
        // Check if exists
        const { data: existing } = await supabase
          .from('app_settings')
          .select('id')
          .eq('key', entry.key)
          .eq('branch_id', branchId || '')
          .maybeSingle();

        if (existing) {
          await supabase.from('app_settings').update({
            value: entry.value,
            updated_by: workerId || null,
          }).eq('id', existing.id);
        } else {
          await supabase.from('app_settings').insert({
            key: entry.key,
            value: entry.value,
            branch_id: branchId,
            updated_by: workerId || null,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-settings'] });
      queryClient.invalidateQueries({ queryKey: ['branch-location'] });
      toast.success('تم حفظ إعدادات المداومة');
      onOpenChange(false);
    },
    onError: () => toast.error('فشل في حفظ الإعدادات'),
  });

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWarehouseLat(pos.coords.latitude.toFixed(6));
        setWarehouseLng(pos.coords.longitude.toFixed(6));
        toast.success('تم التقاط الموقع الحالي');
      },
      () => toast.error('تعذر تحديد الموقع')
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            إعدادات المداومة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Work Start Time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4 text-muted-foreground" />
              توقيت بداية العمل
            </Label>
            <Input
              type="time"
              value={workStartTime}
              onChange={e => setWorkStartTime(e.target.value)}
            />
          </div>

          {/* Max Distance */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Ruler className="w-4 h-4 text-muted-foreground" />
              أقصى مسافة عن المخزن (متر)
            </Label>
            <Input
              type="number"
              min={10}
              max={10000}
              value={maxDistance}
              onChange={e => setMaxDistance(e.target.value)}
              placeholder="50"
            />
          </div>

          {/* Warehouse Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              إحداثيات المخزن
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.000001"
                value={warehouseLat}
                onChange={e => setWarehouseLat(e.target.value)}
                placeholder="خط العرض"
              />
              <Input
                type="number"
                step="0.000001"
                value={warehouseLng}
                onChange={e => setWarehouseLng(e.target.value)}
                placeholder="خط الطول"
              />
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={useCurrentLocation}>
              <MapPin className="w-3.5 h-3.5 ml-1" />
              استخدام موقعي الحالي
            </Button>
          </div>

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceSettingsDialog;
