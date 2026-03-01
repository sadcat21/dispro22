import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, Database } from 'lucide-react';
import { RewardTask } from '@/hooks/useRewards';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TASK_DATA_SOURCES, TASK_CATEGORIES } from '@/data/rewardTriggers';

const ROLE_OPTIONS = [
  { value: 'worker', label: 'عامل توصيل/مبيعات' },
  { value: 'admin', label: 'مدير فرع' },
  { value: 'supervisor', label: 'مشرف' },
  { value: 'branch_admin', label: 'مسؤول مخزن' },
];

interface Props {
  task: RewardTask | null;
  onOpenChange: (open: boolean) => void;
}

const EditRewardTaskDialog: React.FC<Props> = ({ task, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('sales');
  const [dataSource, setDataSource] = useState('');
  const [rewardPoints, setRewardPoints] = useState('10');
  const [penaltyPoints, setPenaltyPoints] = useState('0');
  const [frequency, setFrequency] = useState('daily');
  const [isCumulative, setIsCumulative] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [minCount, setMinCount] = useState('1');
  const [minAmount, setMinAmount] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setCategory(task.category);
      setDataSource(task.data_source);
      setRewardPoints(String(task.reward_points));
      setPenaltyPoints(String(task.penalty_points));
      setFrequency(task.frequency);
      setIsCumulative(task.is_cumulative);
      setIsActive(task.is_active);
      const cl = task.condition_logic || {};
      setMinCount(cl.min_count ? String(cl.min_count) : '');
      setMinAmount(cl.min_amount ? String(cl.min_amount) : '');
      const roles = (task as any).applicable_roles as string[] | null;
      setSelectedRoles(roles || []);
    }
  }, [task]);

  const filteredSources = useMemo(() => {
    return Object.entries(TASK_DATA_SOURCES).filter(([, v]) => v.category === category);
  }, [category]);

  const selectedSource = dataSource ? TASK_DATA_SOURCES[dataSource] : null;

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSubmit = async () => {
    if (!task || !name.trim() || !dataSource) return;
    setSaving(true);
    const conditionLogic: Record<string, any> = {};
    if (minCount) conditionLogic.min_count = Number(minCount);
    if (minAmount) conditionLogic.min_amount = Number(minAmount);

    const { error } = await supabase.from('reward_tasks').update({
      name,
      category,
      data_source: dataSource,
      condition_logic: conditionLogic,
      reward_points: Number(rewardPoints),
      penalty_points: Number(penaltyPoints),
      frequency,
      is_cumulative: isCumulative,
      is_active: isActive,
      applicable_roles: selectedRoles.length > 0 ? selectedRoles : null,
    } as any).eq('id', task.id);
    setSaving(false);
    if (error) { toast.error('حدث خطأ'); return; }
    queryClient.invalidateQueries({ queryKey: ['reward-tasks'] });
    toast.success('تم تحديث المهمة');
    onOpenChange(false);
  };

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل المهمة</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-2">
          <div className="space-y-4 pb-2">
            <div className="space-y-2">
              <Label>اسم المهمة</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: تحقيق هدف المبيعات اليومي" />
            </div>

            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v); setDataSource(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                مصدر البيانات (Trigger)
              </Label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger><SelectValue placeholder="اختر الحدث المرتبط..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredSources.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">لا توجد أحداث لهذه الفئة</div>
                  )}
                  {filteredSources.map(([key, src]) => (
                    <SelectItem key={key} value={key}>
                      <span>{src.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSource && (
                <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    {selectedSource.description}
                  </p>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-[9px]">جدول: {selectedSource.dbTable}</Badge>
                    <Badge variant="secondary" className="text-[9px]">تلقائي ✓</Badge>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>شروط التحقق</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">الحد الأدنى (عدد)</Label>
                  <Input type="number" value={minCount} onChange={e => setMinCount(e.target.value)} placeholder="مثال: 5" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">الحد الأدنى (مبلغ د.ج)</Label>
                  <Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="اختياري" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>التكرار</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">يومي</SelectItem>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>نقاط المكافأة</Label>
                <Input type="number" value={rewardPoints} onChange={e => setRewardPoints(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>نقاط الخصم</Label>
                <Input type="number" value={penaltyPoints} onChange={e => setPenaltyPoints(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الأدوار المستهدفة</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map(role => (
                  <label key={role.value} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md border border-input hover:bg-muted/50">
                    <Checkbox checked={selectedRoles.includes(role.value)} onCheckedChange={() => toggleRole(role.value)} />
                    {role.label}
                  </label>
                ))}
              </div>
              {selectedRoles.length === 0 && (
                <p className="text-[10px] text-muted-foreground">لم يتم تحديد أدوار = تنطبق على الجميع</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label>تراكم النقاط</Label>
              <Switch checked={isCumulative} onCheckedChange={setIsCumulative} />
            </div>

            <div className="flex items-center justify-between">
              <Label>المهمة مفعّلة</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Button onClick={handleSubmit} disabled={saving || !name.trim() || !dataSource} className="w-full">
              حفظ التعديلات
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EditRewardTaskDialog;
