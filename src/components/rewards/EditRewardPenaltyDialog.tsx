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
import { Info, Database, Zap } from 'lucide-react';
import { RewardPenalty } from '@/hooks/useRewards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { PENALTY_TRIGGERS, TRIGGER_CATEGORIES } from '@/data/rewardTriggers';

const ROLE_OPTIONS = [
  { value: 'worker', label: 'عامل توصيل/مبيعات' },
  { value: 'admin', label: 'مدير فرع' },
  { value: 'supervisor', label: 'مشرف' },
  { value: 'branch_admin', label: 'مسؤول مخزن' },
];

interface Props {
  penalty: RewardPenalty | null;
  onOpenChange: (open: boolean) => void;
}

const EditRewardPenaltyDialog: React.FC<Props> = ({ penalty, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [points, setPoints] = useState('5');
  const [trigger, setTrigger] = useState('');
  const [isAutomatic, setIsAutomatic] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (penalty) {
      setName(penalty.name);
      setPoints(String(penalty.penalty_points));
      setTrigger(penalty.trigger_event || 'manual');
      setIsAutomatic(penalty.is_automatic);
      setIsActive(penalty.is_active);
      const roles = (penalty as any).applicable_roles as string[] | null;
      setSelectedRoles(roles || []);
      // Set filter to match trigger's category
      const tDef = PENALTY_TRIGGERS[penalty.trigger_event || 'manual'];
      if (tDef) setFilterCategory(tDef.category);
    }
  }, [penalty]);

  const selectedTrigger = trigger ? PENALTY_TRIGGERS[trigger] : null;
  const isAutoPossible = selectedTrigger && selectedTrigger.dbTable !== '-';

  const filteredTriggers = useMemo(() => {
    return Object.entries(PENALTY_TRIGGERS).filter(([, v]) =>
      filterCategory === 'all' || v.category === filterCategory
    );
  }, [filterCategory]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSubmit = async () => {
    if (!penalty || !name.trim() || !trigger) return;
    setSaving(true);
    const { error } = await supabase.from('reward_penalties').update({
      name,
      penalty_points: Number(points),
      trigger_event: trigger,
      is_automatic: isAutoPossible ? isAutomatic : false,
      is_active: isActive,
      applicable_roles: selectedRoles.length > 0 ? selectedRoles : null,
    } as any).eq('id', penalty.id);
    setSaving(false);
    if (error) { toast.error('حدث خطأ'); return; }
    queryClient.invalidateQueries({ queryKey: ['reward-penalties'] });
    toast.success('تم تحديث المخالفة');
    onOpenChange(false);
  };

  return (
    <Dialog open={!!penalty} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh]" dir="rtl">
        <DialogHeader><DialogTitle>تعديل المخالفة</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-2">
          <div className="space-y-4 pb-2">
            <div className="space-y-2">
              <Label>اسم المخالفة</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: تأخير عن الموعد" />
            </div>

            <div className="space-y-2">
              <Label>نقاط الخصم</Label>
              <Input type="number" value={points} onChange={e => setPoints(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Database className="w-3.5 h-3.5" />حدث التفعيل (Trigger)</Label>
              <div className="flex gap-1.5 flex-wrap mb-2">
                <Badge variant={filterCategory === 'all' ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => setFilterCategory('all')}>الكل</Badge>
                {Object.entries(TRIGGER_CATEGORIES).map(([k, v]) => (
                  <Badge key={k} variant={filterCategory === k ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => setFilterCategory(k)}>{v}</Badge>
                ))}
              </div>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger><SelectValue placeholder="اختر حدث التفعيل..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredTriggers.map(([key, t]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-1.5">
                        {t.dbTable !== '-' && <Zap className="w-3 h-3 text-amber-500" />}
                        <span>{t.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTrigger && (
                <div className="bg-muted/50 rounded-lg p-2.5 space-y-1.5">
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />{selectedTrigger.description}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {selectedTrigger.dbTable !== '-' ? (
                      <>
                        <Badge variant="outline" className="text-[9px]">جدول: {selectedTrigger.dbTable}</Badge>
                        <Badge variant="outline" className="text-[9px]">شرط: {selectedTrigger.dbCondition}</Badge>
                        <Badge className="text-[9px] bg-green-600">يدعم التفعيل التلقائي ✓</Badge>
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-[9px]">يدوي فقط</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>تفعيل تلقائي</Label>
                {!isAutoPossible && trigger && <p className="text-[10px] text-muted-foreground">غير متاح - حدث يدوي</p>}
              </div>
              <Switch checked={isAutomatic} onCheckedChange={setIsAutomatic} disabled={!isAutoPossible} />
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
              <Label>المخالفة مفعّلة</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Button onClick={handleSubmit} disabled={saving || !name.trim() || !trigger} className="w-full">حفظ التعديلات</Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EditRewardPenaltyDialog;
