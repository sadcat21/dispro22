import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useAllWorkersPoints } from '@/hooks/useRewards';
import { useRewardConfig } from '@/hooks/useRewardConfig';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generatePDF } from '@/utils/generatePDF';
import { toast } from 'sonner';

const RewardReportsTab: React.FC = () => {
  const { activeBranch } = useAuth();
  const { data: workersPoints } = useAllWorkersPoints();
  const { data: config } = useRewardConfig();
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: workers } = useQuery({
    queryKey: ['workers-for-reports', activeBranch?.id],
    queryFn: async () => {
      let query = supabase.from('workers').select('id, full_name, salary, bonus_cap_percentage, role').eq('is_active', true);
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { data } = await query;
      return data || [];
    },
  });

  const pointValue = config?.point_value || 10;

  const reportData = (workers || [])
    .map(w => {
      const pts = workersPoints?.[w.id] || { rewards: 0, penalties: 0, total: 0 };
      const rawBonus = Math.max(0, pts.total) * pointValue;
      const salary = Number(w.salary) || 0;
      const capPct = Number(w.bonus_cap_percentage) || 20;
      const maxBonus = salary > 0 ? salary * (capPct / 100) : rawBonus;
      return {
        name: w.full_name,
        rewards: pts.rewards,
        penalties: pts.penalties,
        total: pts.total,
        rawBonus,
        finalBonus: Math.min(rawBonus, maxBonus),
        salary,
      };
    })
    .sort((a, b) => b.total - a.total);

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      await generatePDF(printRef.current, `تقرير_المكافآت_${selectedMonth}.pdf`);
      toast.success('تم تصدير PDF بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء التصدير');
    }
  };

  const handleExportCSV = () => {
    const headers = ['الاسم', 'نقاط المكافأة', 'نقاط الخصم', 'الإجمالي', 'المكافأة المحسوبة', 'المكافأة النهائية', 'الراتب'];
    const rows = reportData.map(r => [r.name, r.rewards, r.penalties, r.total, r.rawBonus, r.finalBonus, r.salary]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_المكافآت_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير Excel/CSV بنجاح');
  };

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-1">
          <FileText className="w-4 h-4" /> PDF
        </Button>
        <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1">
          <FileSpreadsheet className="w-4 h-4" /> CSV
        </Button>
      </div>

      <div ref={printRef} className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              تقرير المكافآت - {selectedMonth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-1">#</th>
                    <th className="text-right py-2 px-1">الاسم</th>
                    <th className="text-center py-2 px-1">مكافآت</th>
                    <th className="text-center py-2 px-1">خصومات</th>
                    <th className="text-center py-2 px-1">الإجمالي</th>
                    <th className="text-center py-2 px-1">المكافأة</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-1 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-1 font-medium">{r.name}</td>
                      <td className="py-2 px-1 text-center text-green-600">+{r.rewards}</td>
                      <td className="py-2 px-1 text-center text-red-500">-{r.penalties}</td>
                      <td className="py-2 px-1 text-center font-bold">{r.total}</td>
                      <td className="py-2 px-1 text-center">{r.finalBonus.toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={2} className="py-2 px-1">المجموع</td>
                    <td className="text-center py-2 text-green-600">+{reportData.reduce((s, r) => s + r.rewards, 0)}</td>
                    <td className="text-center py-2 text-red-500">-{reportData.reduce((s, r) => s + r.penalties, 0)}</td>
                    <td className="text-center py-2">{reportData.reduce((s, r) => s + r.total, 0)}</td>
                    <td className="text-center py-2">{reportData.reduce((s, r) => s + r.finalBonus, 0).toLocaleString()} DA</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RewardReportsTab;
