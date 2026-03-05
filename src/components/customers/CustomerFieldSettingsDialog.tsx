import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Settings2, Eye, Phone, PlusCircle, CreditCard, Banknote, Truck, ShoppingBag, Navigation, Tag, Pencil, Trash2 } from 'lucide-react';
import { useCustomerFieldSettings } from '@/hooks/useCustomerFieldSettings';
import {
  CustomerFieldKey,
  CustomerFieldSettings,
  CustomerActionButtonKey,
  ActionButtonConfig,
  CUSTOMER_FIELD_OPTIONS,
  ACTION_BUTTON_LABELS,
  ACTION_BUTTON_DEFAULTS,
} from '@/types/customerFieldSettings';

interface CustomerFieldSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TAB_CONFIG = [
  { value: 'editable', label: 'قابل للتعديل للعمال', key: 'editableByWorkers' as const },
  { value: 'completion', label: 'يُحتسب في الاكتمال', key: 'completionFields' as const },
  { value: 'requiredEdit', label: 'إلزامي في التعديل', key: 'requiredOnEdit' as const },
  { value: 'requiredCreate', label: 'إلزامي في الإضافة', key: 'requiredOnCreate' as const },
];

const ACTION_BUTTON_ICONS: Record<CustomerActionButtonKey, React.ElementType> = {
  view_profile: Eye,
  call: Phone,
  new_order: PlusCircle,
  debts: CreditCard,
  direct_sale: Banknote,
  delivery: Truck,
  last_order: ShoppingBag,
  navigate: Navigation,
  special_prices: Tag,
  edit: Pencil,
  delete: Trash2,
};

const ACTION_BUTTON_ORDER: CustomerActionButtonKey[] = [
  'delete', 'edit', 'special_prices', 'last_order', 'delivery', 'direct_sale', 'debts', 'new_order', 'call', 'view_profile', 'navigate',
];

const CustomerFieldSettingsDialog: React.FC<CustomerFieldSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { settings, isLoading, saveSettings, isSaving } = useCustomerFieldSettings();
  const [draft, setDraft] = useState<CustomerFieldSettings>(settings);

  useEffect(() => {
    if (open) {
      setDraft(settings);
    }
  }, [open, settings]);

  const counts = useMemo(
    () => ({
      editable: draft.editableByWorkers.length,
      completion: draft.completionFields.length,
      requiredEdit: draft.requiredOnEdit.length,
      requiredCreate: draft.requiredOnCreate.length,
    }),
    [draft],
  );

  const toggleField = (
    target: 'editableByWorkers' | 'completionFields' | 'requiredOnEdit' | 'requiredOnCreate',
    fieldKey: CustomerFieldKey,
    checked: boolean,
  ) => {
    setDraft((prev) => {
      const source = prev[target];
      const nextValues = checked
        ? Array.from(new Set([...source, fieldKey]))
        : source.filter((item) => item !== fieldKey);

      return {
        ...prev,
        [target]: nextValues,
      };
    });
  };

  const updateActionButton = (key: CustomerActionButtonKey, partial: Partial<ActionButtonConfig>) => {
    setDraft((prev) => ({
      ...prev,
      actionButtons: {
        ...prev.actionButtons,
        [key]: { ...prev.actionButtons[key], ...partial },
      },
    }));
  };

  const handleSave = async () => {
    try {
      await saveSettings(draft);
      onOpenChange(false);
    } catch {
      // Error toast is handled inside the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            إعدادات حقول العميل
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Tabs defaultValue="editable" className="w-full" dir="rtl">
              <TabsList className="grid w-full grid-cols-5 h-auto">
                <TabsTrigger value="editable" className="text-[10px] py-2">تعديل ({counts.editable})</TabsTrigger>
                <TabsTrigger value="completion" className="text-[10px] py-2">اكتمال ({counts.completion})</TabsTrigger>
                <TabsTrigger value="requiredEdit" className="text-[10px] py-2">إلزامي تعديل ({counts.requiredEdit})</TabsTrigger>
                <TabsTrigger value="requiredCreate" className="text-[10px] py-2">إلزامي إضافة ({counts.requiredCreate})</TabsTrigger>
                <TabsTrigger value="actionButtons" className="text-[10px] py-2">الأزرار</TabsTrigger>
              </TabsList>

              {TAB_CONFIG.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="mt-3">
                  <ScrollArea className="h-[320px] rounded-md border p-3">
                    <div className="space-y-3">
                      {CUSTOMER_FIELD_OPTIONS.map((field) => {
                        const checked = draft[tab.key].includes(field.key);
                        return (
                          <div key={field.key} className="flex items-center justify-between rounded-md border p-2">
                            <Label htmlFor={`${tab.value}-${field.key}`} className="text-sm cursor-pointer">
                              {field.label}
                            </Label>
                            <Switch
                              id={`${tab.value}-${field.key}`}
                              checked={checked}
                              onCheckedChange={(value) => toggleField(tab.key, field.key, value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}

              {/* Action Buttons Tab */}
              <TabsContent value="actionButtons" className="mt-3">
                <ScrollArea className="h-[320px] rounded-md border p-3">
                  <div className="space-y-3">
                    {ACTION_BUTTON_ORDER.map((btnKey) => {
                      const config = draft.actionButtons[btnKey] || ACTION_BUTTON_DEFAULTS[btnKey];
                      const IconComp = ACTION_BUTTON_ICONS[btnKey];
                      return (
                        <div key={btnKey} className="rounded-md border p-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <IconComp className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium flex-1">{ACTION_BUTTON_LABELS[btnKey]}</span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Label htmlFor={`vis-${btnKey}`} className="text-[10px] text-muted-foreground">إظهار</Label>
                                <Switch
                                  id={`vis-${btnKey}`}
                                  checked={config.visible}
                                  onCheckedChange={(v) => updateActionButton(btnKey, { visible: v })}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Label htmlFor={`lbl-${btnKey}`} className="text-[10px] text-muted-foreground">نص</Label>
                                <Switch
                                  id={`lbl-${btnKey}`}
                                  checked={config.showLabel}
                                  onCheckedChange={(v) => updateActionButton(btnKey, { showLabel: v })}
                                />
                              </div>
                            </div>
                          </div>
                          {config.showLabel && (
                            <Input
                              value={config.label}
                              onChange={(e) => updateActionButton(btnKey, { label: e.target.value })}
                              className="h-7 text-xs"
                              placeholder={ACTION_BUTTON_LABELS[btnKey]}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomerFieldSettingsDialog;
