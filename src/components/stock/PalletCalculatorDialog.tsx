import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calculator, Settings, Package, Layers, ArrowRight, Delete } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import PalletSettingsDialog from './PalletSettingsDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatLayerBoxes = (layers: number, boxes: number): string => {
  const boxStr = boxes < 10 ? `0${boxes}` : `${boxes}`;
  return `${layers}.${boxStr}`;
};

const parseLayerBoxes = (value: string): { layers: number; boxes: number } | null => {
  if (!value || !value.includes('.')) return null;
  const [layerStr, boxStr] = value.split('.');
  return { layers: parseInt(layerStr) || 0, boxes: parseInt(boxStr) || 0 };
};

type ActiveField = 'desired' | 'available';

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

const PalletCalculatorDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { activeBranch } = useAuth();
  const branchId = activeBranch?.id || null;
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSettingId, setSelectedSettingId] = useState<string>('');
  const [desiredBoxes, setDesiredBoxes] = useState<string>('');
  const [availableInput, setAvailableInput] = useState<string>('');
  const [activeField, setActiveField] = useState<ActiveField>('desired');

  const { data: palletSettings = [], refetch: refetchSettings } = useQuery({
    queryKey: ['pallet-settings-calculator', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pallet_settings')
        .select('id, name, boxes_per_pallet, boxes_per_layer')
        .eq('branch_id', branchId!);
      return data || [];
    },
    enabled: open && !!branchId,
  });

  const currentSetting = useMemo(() => {
    if (!selectedSettingId) return null;
    return palletSettings.find(s => s.id === selectedSettingId) || null;
  }, [selectedSettingId, palletSettings]);

  const boxesPerLayer = currentSetting?.boxes_per_layer || 0;

  const handleNumpad = useCallback((key: string) => {
    const setter = activeField === 'desired' ? setDesiredBoxes : setAvailableInput;
    if (key === 'del') {
      setter(prev => prev.slice(0, -1));
    } else if (key === '.') {
      setter(prev => {
        if (activeField === 'desired') return prev; // no dot for desired (integer)
        if (prev.includes('.')) return prev;
        return prev + '.';
      });
    } else {
      setter(prev => prev + key);
    }
  }, [activeField]);

  const desiredResult = useMemo(() => {
    const total = parseInt(desiredBoxes) || 0;
    if (total <= 0 || boxesPerLayer <= 0) return null;
    const layers = Math.floor(total / boxesPerLayer);
    const remaining = total % boxesPerLayer;
    return { layers, boxes: remaining, formatted: formatLayerBoxes(layers, remaining) };
  }, [desiredBoxes, boxesPerLayer]);

  const remainderResult = useMemo(() => {
    if (!desiredResult || !availableInput) return null;
    const available = parseLayerBoxes(availableInput);
    if (!available) return null;
    const totalAvailable = available.layers * boxesPerLayer + available.boxes;
    const totalDesired = parseInt(desiredBoxes) || 0;
    const leftover = totalAvailable - totalDesired;
    if (leftover < 0) return { layers: 0, boxes: 0, formatted: 'غير كافٍ', deficit: true };
    const layers = Math.floor(leftover / boxesPerLayer);
    const boxes = leftover % boxesPerLayer;
    return { layers, boxes, formatted: formatLayerBoxes(layers, boxes), deficit: false };
  }, [availableInput, desiredResult, desiredBoxes, boxesPerLayer]);

  const configuredTypes = useMemo(() => {
    return palletSettings.filter(s => (s.boxes_per_layer ?? 0) > 0 && s.name);
  }, [palletSettings]);

  const showCalcDialog = !!selectedSettingId && boxesPerLayer > 0;

  return (
    <>
      {/* Main type picker */}
      <Dialog open={open && !showCalcDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                حاسبة الطبقات
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div>
            <Label className="text-sm font-medium mb-2 block">اختر نوع التغليف</Label>
            {configuredTypes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-xl border-dashed">
                <Settings className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>لا توجد أنواع تغليف</p>
                <Button variant="link" size="sm" onClick={() => setShowSettings(true)}>
                  اضبط الإعدادات أولاً
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-1">
                {configuredTypes.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedSettingId(item.id);
                      setDesiredBoxes('');
                      setAvailableInput('');
                      setActiveField('desired');
                    }}
                    className="rounded-xl p-4 text-center transition-all border-2 border-transparent bg-muted hover:bg-accent hover:border-primary/30 active:scale-95"
                  >
                    <Package className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-sm font-bold leading-tight">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.boxes_per_layer} صندوق/طبقة
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculator sub-dialog with custom numpad */}
      <Dialog
        open={showCalcDialog}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedSettingId('');
            setDesiredBoxes('');
            setAvailableInput('');
          }
        }}
      >
        <DialogContent className="max-w-sm p-3" dir="rtl">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="truncate text-sm">{currentSetting?.name}</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] bg-muted rounded-full px-1.5 py-0.5 font-normal text-muted-foreground">
                  <Layers className="w-2.5 h-2.5" />
                  {boxesPerLayer} ص/ط
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 h-7"
                onClick={() => {
                  setSelectedSettingId('');
                  setDesiredBoxes('');
                  setAvailableInput('');
                }}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                رجوع
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {/* Row 1: Desired boxes + result */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveField('desired')}
                className={`rounded-lg p-2 text-center border-2 transition-colors ${
                  activeField === 'desired' ? 'border-primary bg-primary/5' : 'border-transparent bg-muted'
                }`}
              >
                <p className="text-[10px] text-muted-foreground mb-0.5">الصناديق المطلوبة</p>
                <p className={`text-xl font-black min-h-[1.75rem] ${desiredBoxes ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                  {desiredBoxes || '0'}
                </p>
              </button>
              <div className={`rounded-lg p-2 text-center flex flex-col justify-center ${desiredResult ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
                <p className="text-[10px] text-muted-foreground">يجب أن تأخذ</p>
                <p className={`text-xl font-black ${desiredResult ? 'text-primary' : 'text-muted-foreground/30'}`}>
                  {desiredResult ? desiredResult.formatted : '—'}
                </p>
                {desiredResult && (
                  <p className="text-[10px] text-muted-foreground">
                    {desiredResult.layers} ط · {desiredResult.boxes} ص
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Available + remainder */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveField('available')}
                className={`rounded-lg p-2 text-center border-2 transition-colors ${
                  activeField === 'available' ? 'border-primary bg-primary/5' : 'border-transparent bg-muted'
                }`}
              >
                <p className="text-[10px] text-muted-foreground mb-0.5">المتوفر (ط.ص)</p>
                <p className={`text-xl font-black min-h-[1.75rem] ${availableInput ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                  {availableInput || '0.00'}
                </p>
                {availableInput && parseLayerBoxes(availableInput) && (
                  <p className="text-[10px] text-muted-foreground">
                    = {(parseLayerBoxes(availableInput)!.layers * boxesPerLayer) + parseLayerBoxes(availableInput)!.boxes} ص
                  </p>
                )}
              </button>
              <div className={`rounded-lg p-2 text-center flex flex-col justify-center border ${
                remainderResult
                  ? remainderResult.deficit
                    ? 'bg-destructive/10 border-destructive/20'
                    : 'bg-primary/5 border-primary/20'
                  : 'bg-muted border-transparent'
              }`}>
                <p className="text-[10px] text-muted-foreground">
                  {remainderResult?.deficit ? 'غير كافٍ!' : 'يجب أن تترك'}
                </p>
                <p className={`text-xl font-black ${
                  remainderResult
                    ? remainderResult.deficit ? 'text-destructive' : 'text-primary'
                    : 'text-muted-foreground/30'
                }`}>
                  {remainderResult ? (remainderResult.deficit ? '✕' : remainderResult.formatted) : '—'}
                </p>
                {remainderResult && !remainderResult.deficit && (
                  <p className="text-[10px] text-muted-foreground">
                    {remainderResult.layers} ط · {remainderResult.boxes} ص
                  </p>
                )}
              </div>
            </div>

            {/* Custom numpad */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {NUMPAD_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNumpad(key)}
                  className={`h-11 rounded-lg font-bold text-lg transition-all active:scale-95 ${
                    key === 'del'
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center'
                      : key === '.'
                        ? activeField === 'desired'
                          ? 'bg-muted text-muted-foreground/30 cursor-not-allowed'
                          : 'bg-muted text-foreground hover:bg-accent'
                        : 'bg-muted text-foreground hover:bg-accent'
                  }`}
                  disabled={key === '.' && activeField === 'desired'}
                >
                  {key === 'del' ? <Delete className="w-5 h-5" /> : key}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {branchId && (
        <PalletSettingsDialog
          open={showSettings}
          onOpenChange={(v) => {
            setShowSettings(v);
            if (!v) refetchSettings();
          }}
          branchId={branchId}
          showLayerField
        />
      )}
    </>
  );
};

export default PalletCalculatorDialog;
