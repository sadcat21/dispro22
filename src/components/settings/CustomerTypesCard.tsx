import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Store, Loader2, GripVertical } from 'lucide-react';
import { useCustomerTypes, CustomerTypeEntry } from '@/hooks/useCustomerTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CustomerTypesCard: React.FC = () => {
  const { customerTypes, isLoading, updateTypes } = useCustomerTypes();
  const { language } = useLanguage();
  const [newType, setNewType] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleAdd = async () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (customerTypes.some(t => t.ar === trimmed || t.fr === trimmed || t.en === trimmed)) {
      toast.error('هذا النوع موجود بالفعل');
      return;
    }

    setIsTranslating(true);
    try {
      const sourceLang = language;
      const targetLangs = (['ar', 'fr', 'en'] as const).filter(l => l !== sourceLang);

      const { data: translateData, error: translateError } = await supabase.functions.invoke('translate-text', {
        body: { text: trimmed, sourceLang, targetLangs, mode: 'translate' },
      });

      let entry: CustomerTypeEntry;
      if (translateError || !translateData?.translations) {
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

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const reordered = [...customerTypes];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    dragItem.current = null;
    dragOverItem.current = null;
    try {
      await updateTypes.mutateAsync(reordered);
    } catch {
      toast.error('فشل في تغيير الترتيب');
    }
  };

  // Touch drag support
  const touchStartY = useRef<number>(0);
  const touchItemIndex = useRef<number | null>(null);

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    touchItemIndex.current = index;
    touchStartY.current = e.touches[0].clientY;
    dragItem.current = index;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchItemIndex.current === null) return;
    const touch = e.touches[0];
    const elements = document.querySelectorAll('[data-type-index]');
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const idx = parseInt(el.getAttribute('data-type-index') || '0');
        dragOverItem.current = idx;
      }
    });
  };

  const handleTouchEnd = () => {
    touchItemIndex.current = null;
    handleDragEnd();
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
        {/* Sortable list */}
        <div className="space-y-1">
          {customerTypes.map((entry, index) => (
            <div
              key={entry.ar}
              data-type-index={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onTouchStart={(e) => handleTouchStart(index, e)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing group"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{entry[language] || entry.ar}</div>
                <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                  <span>🇩🇿 {entry.ar}</span>
                  <span>🇫🇷 {entry.fr}</span>
                  <span>🇺🇸 {entry.en}</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 hover:text-destructive"
                onClick={() => handleRemove(entry)}
                disabled={isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add new type */}
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
          هذه الأنواع تظهر كأزرار سريعة عند إضافة أو تعديل العملاء — يتم ترجمتها تلقائياً — اسحب للترتيب
        </p>
      </CardContent>
    </Card>
  );
};

export default CustomerTypesCard;
