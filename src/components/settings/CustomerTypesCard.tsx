import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Store, Loader2 } from 'lucide-react';
import { useCustomerTypes, CustomerTypeEntry } from '@/hooks/useCustomerTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CustomerTypesCard: React.FC = () => {
  const { customerTypes, isLoading, updateTypes } = useCustomerTypes();
  const { language } = useLanguage();
  const [newType, setNewType] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleAdd = async () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (customerTypes.some(t => t.ar === trimmed || t.fr === trimmed || t.en === trimmed)) {
      toast.error('هذا النوع موجود بالفعل');
      return;
    }

    setIsTranslating(true);
    try {
      // Determine source language and target languages
      const sourceLang = language;
      const targetLangs = (['ar', 'fr', 'en'] as const).filter(l => l !== sourceLang);

      // Call translate-text edge function
      const { data: translateData, error: translateError } = await supabase.functions.invoke('translate-text', {
        body: { text: trimmed, sourceLang, targetLangs, mode: 'translate' },
      });

      let entry: CustomerTypeEntry;
      if (translateError || !translateData?.translations) {
        // Fallback: use the same text for all languages
        entry = { ar: trimmed, fr: trimmed, en: trimmed };
      } else {
        entry = {
          ar: sourceLang === 'ar' ? trimmed : (translateData.translations.ar || trimmed),
          fr: sourceLang === 'fr' ? trimmed : (translateData.translations.fr || trimmed),
          en: sourceLang === 'en' ? trimmed : (translateData.translations.en || trimmed),
        };
      }

      await updateTypes.mutateAsync([...customerTypes, entry]);
      setNewType('');
      toast.success('تم إضافة النوع بنجاح');
    } catch {
      toast.error('فشل في الإضافة');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRemove = async (entry: CustomerTypeEntry) => {
    try {
      await updateTypes.mutateAsync(customerTypes.filter(t => t.ar !== entry.ar));
      toast.success('تم حذف النوع');
    } catch {
      toast.error('فشل في الحذف');
    }
  };

  const isPending = updateTypes.isPending || isTranslating;

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Store className="w-5 h-5" />
          أنواع العملاء
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {customerTypes.map((entry) => (
            <Badge key={entry.ar} variant="secondary" className="text-sm px-3 py-1.5 gap-1.5">
              <span className="flex flex-col items-start leading-tight">
                <span>{entry[language] || entry.ar}</span>
                {language !== 'ar' && (
                  <span className="text-[10px] text-muted-foreground">{entry.ar}</span>
                )}
              </span>
              <button
                onClick={() => handleRemove(entry)}
                className="hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="نوع جديد..."
            className="text-right flex-1"
            disabled={isPending}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newType.trim() || isPending}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          هذه الأنواع تظهر كأزرار سريعة عند إضافة أو تعديل العملاء — يتم ترجمتها تلقائياً
        </p>
      </CardContent>
    </Card>
  );
};

export default CustomerTypesCard;
