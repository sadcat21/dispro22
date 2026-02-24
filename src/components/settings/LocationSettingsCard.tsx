import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Save, Loader2 } from 'lucide-react';
import { useLocationThreshold, useUpdateLocationThreshold } from '@/hooks/useLocationSettings';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const LocationSettingsCard: React.FC = () => {
  const { t } = useLanguage();
  const { data: threshold, isLoading } = useLocationThreshold();
  const updateThreshold = useUpdateLocationThreshold();
  const [value, setValue] = useState('100');

  useEffect(() => {
    if (threshold !== undefined) {
      setValue(threshold.toString());
    }
  }, [threshold]);

  const handleSave = async () => {
    const meters = parseInt(value, 10);
    if (isNaN(meters) || meters < 10 || meters > 10000) {
      toast.error('يرجى إدخال قيمة بين 10 و 10000 متر');
      return;
    }
    try {
      await updateThreshold.mutateAsync(meters);
      toast.success('تم حفظ إعدادات الموقع');
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5" />
          إعدادات التحقق من الموقع
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>المسافة القصوى للتحقق من موقع العميل (بالمتر)</Label>
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="number"
                min={10}
                max={10000}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSave}
                disabled={updateThreshold.isPending}
                size="sm"
              >
                {updateThreshold.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 ms-1" />
                )}
                حفظ
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            إذا كان العامل أبعد من هذه المسافة عن العميل، سيظهر تحذير. القيمة الافتراضية: 100 متر
          </p>
        </div>
        <div className="space-y-2">
          <Label>تجاوز التحقق من الموقع</Label>
          <p className="text-xs text-muted-foreground">
            لتحديد العمال الذين يمكنهم تمرير الطلبيات خارج موقع العميل، قم بتعيين صلاحية "تجاوز التحقق من الموقع" للدور المناسب من صفحة الصلاحيات.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationSettingsCard;
