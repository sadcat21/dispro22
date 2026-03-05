import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAppUpdateUrl } from '@/hooks/useAppUpdateUrl';
import { useLanguage } from '@/contexts/LanguageContext';
import { checkForAppUpdate, getCurrentAppVersion } from '@/utils/appUpdate';
import { toast } from 'sonner';

const AppUpdateSettingsCard: React.FC = () => {
  const { appUpdateUrl, isLoading, updateAppUpdateUrl, isUpdating } = useAppUpdateUrl();
  const { t } = useLanguage();
  const [url, setUrl] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    setUrl(appUpdateUrl);
    // Get current version on mount
    getCurrentAppVersion().then(version => setCurrentVersion(version));
  }, [appUpdateUrl]);

  const handleSave = () => {
    updateAppUpdateUrl(url);
  };

  const handleCheckUpdate = async () => {
    setIsChecking(true);
    try {
      const result = await checkForAppUpdate();
      if (result.available) {
        toast.success(`يوجد تحديث متوفر! الإصدار الجديد: ${result.version}`);
      } else {
        toast.info('التطبيق محدث - لا توجد تحديثات جديدة');
      }
    } catch (error) {
      toast.error('فشل في التحقق من التحديثات');
    } finally {
      setIsChecking(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="w-5 h-5" />
          إعدادات تحديث التطبيق
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Version Info */}
        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">الإصدار الحالي:</span>
          <span className="font-medium">{currentVersion || 'غير محدد'}</span>
        </div>

        {/* Update URL Setting */}
        <div className="space-y-2">
          <Label htmlFor="app-update-url">رابط خادم التحديثات</Label>
          <Input
            id="app-update-url"
            type="url"
            placeholder="https://api.laserfood.com/updates"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            أدخل رابط خادم التحديثات الذي سيتم التحقق منه للحصول على تحديثات التطبيق
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={isUpdating || url === appUpdateUrl}
            className="flex-1"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin ms-2" />
            ) : (
              <Save className="w-4 h-4 ms-2" />
            )}
            حفظ
          </Button>

          <Button
            onClick={handleCheckUpdate}
            disabled={isChecking}
            variant="outline"
            className="flex-1"
          >
            {isChecking ? (
              <Loader2 className="w-4 h-4 animate-spin ms-2" />
            ) : (
              <CheckCircle className="w-4 h-4 ms-2" />
            )}
            فحص التحديثات
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppUpdateSettingsCard;