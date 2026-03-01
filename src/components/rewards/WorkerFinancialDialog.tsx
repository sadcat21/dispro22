import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Wallet, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId?: string;
  workerName?: string;
}

const WorkerFinancialDialog: React.FC<Props> = ({ open, onOpenChange, workerId, workerName }) => {
  const queryClient = useQueryClient();
  const [salary, setSalary] = useState('');
  const [bonusCap, setBonusCap] = useState('');
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: worker } = useQuery({
    queryKey: ['worker-financial', workerId],
    queryFn: async () => {
      if (!workerId) return null;
      const { data } = await supabase.from('workers').select('salary, bonus_cap_percentage, department').eq('id', workerId).single();
      return data;
    },
    enabled: !!workerId && open,
  });

  const { data: pointsSummary } = useQuery({
    queryKey: ['worker-points-summary', workerId],
    queryFn: async () => {
      if (!workerId) return null;
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data } = await supabase.from('employee_points_log')
        .select('points, point_type')
        .eq('worker_id', workerId)
        .gte('point_date', `${currentMonth}-01`);
      
      const rewards = (data || []).filter(p => p.point_type === 'reward').reduce((s, p) => s + p.points, 0);
      const penalties = (data || []).filter(p => p.point_type === 'penalty').reduce((s, p) => s + p.points, 0);
      return { rewards, penalties, net: rewards - penalties };
    },
    enabled: !!workerId && open,
  });

  useEffect(() => {
    if (worker) {
      setSalary(String(worker.salary || ''));
      setBonusCap(String(worker.bonus_cap_percentage || ''));
      setDepartment(worker.department || '');
    }
  }, [worker]);

  const handleSave = async () => {
    if (!workerId) return;
    setSaving(true);
    const { error } = await supabase.from('workers').update({
      salary: salary ? Number(salary) : null,
      bonus_cap_percentage: bonusCap ? Number(bonusCap) : null,
      department: department || null,
    }).eq('id', workerId);
    setSaving(false);
    if (error) { toast.error('حدث خطأ'); return; }
    queryClient.invalidateQueries({ queryKey: ['worker-financial', workerId] });
    toast.success('تم حفظ البيانات المالية');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            البيانات المالية - {workerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Points Summary */}
          {pointsSummary && (
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                <TrendingUp className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
                <p className="text-lg font-bold text-emerald-700">{pointsSummary.rewards}</p>
                <p className="text-[10px] text-emerald-600">نقاط مكافآت</p>
              </div>
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-center">
                <TrendingDown className="w-4 h-4 mx-auto text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-700">{pointsSummary.penalties}</p>
                <p className="text-[10px] text-red-600">نقاط عقوبات</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-center">
                <Award className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                <p className="text-lg font-bold text-blue-700">{pointsSummary.net}</p>
                <p className="text-[10px] text-blue-600">صافي النقاط</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>الأجرة الشهرية (DA)</Label>
            <Input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="مثال: 30000" />
            <p className="text-[10px] text-muted-foreground">تُستخدم لحساب الحد الأقصى للمكافأة كنسبة من الراتب</p>
          </div>

          <div className="space-y-2">
            <Label>الحد الأقصى للمكافأة (% من الأجرة)</Label>
            <Input type="number" value={bonusCap} onChange={e => setBonusCap(e.target.value)} placeholder="مثال: 30" />
            <p className="text-[10px] text-muted-foreground">
              {salary && bonusCap ? (
                <>الحد الأقصى: {(Number(salary) * Number(bonusCap) / 100).toLocaleString('ar-DZ')} د.ج</>
              ) : 'أدخل الأجرة والنسبة لحساب الحد الأقصى'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>القسم / الوظيفة</Label>
            <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="مثال: مبيعات، توصيل، مخزن" />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 ml-2" />
            حفظ البيانات المالية
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerFinancialDialog;
