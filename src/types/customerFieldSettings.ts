export type CustomerFieldKey =
  | 'name'
  | 'name_fr'
  | 'phone'
  | 'store_name'
  | 'customer_type'
  | 'internal_name'
  | 'sales_rep_name'
  | 'sector_id'
  | 'zone_id'
  | 'address'
  | 'wilaya'
  | 'location'
  | 'default_delivery_worker_id';

// --- Action button keys (customer card) ---
export type CustomerActionButtonKey =
  | 'view_profile'
  | 'call'
  | 'new_order'
  | 'debts'
  | 'direct_sale'
  | 'delivery'
  | 'last_order'
  | 'navigate'
  | 'special_prices'
  | 'edit'
  | 'delete';

export interface ActionButtonConfig {
  visible: boolean;
  showLabel: boolean;
  label: string;
}

export interface CustomerFieldSettings {
  editableByWorkers: CustomerFieldKey[];
  completionFields: CustomerFieldKey[];
  requiredOnEdit: CustomerFieldKey[];
  requiredOnCreate: CustomerFieldKey[];
  actionButtons: Record<CustomerActionButtonKey, ActionButtonConfig>;
}

export const CUSTOMER_FIELD_LABELS: Record<CustomerFieldKey, string> = {
  name: 'اسم العميل',
  name_fr: 'اسم العميل بالفرنسية',
  phone: 'الهاتف',
  store_name: 'اسم المحل',
  customer_type: 'نوع العميل',
  internal_name: 'الاسم الداخلي',
  sales_rep_name: 'مسؤول المبيعات/المشتريات',
  sector_id: 'السكتور',
  zone_id: 'المنطقة داخل السكتور',
  address: 'العنوان',
  wilaya: 'الولاية',
  location: 'الموقع الجغرافي (GPS)',
  default_delivery_worker_id: 'عامل التوصيل الافتراضي',
};

export const ACTION_BUTTON_DEFAULTS: Record<CustomerActionButtonKey, ActionButtonConfig> = {
  view_profile: { visible: true, showLabel: false, label: 'عرض الملف' },
  call: { visible: true, showLabel: false, label: 'اتصال' },
  new_order: { visible: true, showLabel: false, label: 'طلبية جديدة' },
  debts: { visible: true, showLabel: false, label: 'الديون' },
  direct_sale: { visible: true, showLabel: false, label: 'بيع مباشر' },
  delivery: { visible: true, showLabel: false, label: 'توصيل' },
  last_order: { visible: true, showLabel: false, label: 'آخر طلبية' },
  navigate: { visible: true, showLabel: false, label: 'الاتجاهات' },
  special_prices: { visible: true, showLabel: false, label: 'أسعار خاصة' },
  edit: { visible: true, showLabel: false, label: 'تعديل' },
  delete: { visible: true, showLabel: false, label: 'حذف' },
};

export const ACTION_BUTTON_LABELS: Record<CustomerActionButtonKey, string> = {
  view_profile: 'عرض الملف',
  call: 'اتصال',
  new_order: 'طلبية جديدة',
  debts: 'الديون',
  direct_sale: 'بيع مباشر',
  delivery: 'توصيل',
  last_order: 'آخر طلبية',
  navigate: 'الاتجاهات',
  special_prices: 'أسعار خاصة',
  edit: 'تعديل',
  delete: 'حذف',
};

export const CUSTOMER_FIELD_OPTIONS: Array<{ key: CustomerFieldKey; label: string }> =
  (Object.keys(CUSTOMER_FIELD_LABELS) as CustomerFieldKey[]).map((key) => ({
    key,
    label: CUSTOMER_FIELD_LABELS[key],
  }));

export const DEFAULT_CUSTOMER_FIELD_SETTINGS: CustomerFieldSettings = {
  editableByWorkers: CUSTOMER_FIELD_OPTIONS.map((item) => item.key),
  completionFields: [
    'name',
    'phone',
    'store_name',
    'sector_id',
    'location',
    'address',
    'wilaya',
    'name_fr',
    'internal_name',
    'sales_rep_name',
    'zone_id',
  ],
  requiredOnEdit: ['name'],
  requiredOnCreate: ['name', 'phone', 'store_name', 'sector_id', 'location'],
  actionButtons: { ...ACTION_BUTTON_DEFAULTS },
};

const isCustomerFieldKey = (value: string): value is CustomerFieldKey =>
  value in CUSTOMER_FIELD_LABELS;

const sanitizeKeys = (value: unknown, fallback: CustomerFieldKey[]): CustomerFieldKey[] => {
  if (!Array.isArray(value)) return [...fallback];
  const unique = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .filter(isCustomerFieldKey),
    ),
  );

  return unique.length > 0 ? unique : [...fallback];
};

const sanitizeActionButtons = (
  value: unknown,
): Record<CustomerActionButtonKey, ActionButtonConfig> => {
  const result = { ...ACTION_BUTTON_DEFAULTS };
  if (!value || typeof value !== 'object') return result;

  const source = value as Record<string, unknown>;
  for (const key of Object.keys(ACTION_BUTTON_DEFAULTS) as CustomerActionButtonKey[]) {
    if (source[key] && typeof source[key] === 'object') {
      const btn = source[key] as Record<string, unknown>;
      result[key] = {
        visible: typeof btn.visible === 'boolean' ? btn.visible : ACTION_BUTTON_DEFAULTS[key].visible,
        showLabel: typeof btn.showLabel === 'boolean' ? btn.showLabel : ACTION_BUTTON_DEFAULTS[key].showLabel,
        label: typeof btn.label === 'string' && btn.label.trim() ? btn.label : ACTION_BUTTON_DEFAULTS[key].label,
      };
    }
  }
  return result;
};

export const normalizeCustomerFieldSettings = (value: unknown): CustomerFieldSettings => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CUSTOMER_FIELD_SETTINGS };

  const source = value as Partial<CustomerFieldSettings>;

  return {
    editableByWorkers: sanitizeKeys(source.editableByWorkers, DEFAULT_CUSTOMER_FIELD_SETTINGS.editableByWorkers),
    completionFields: sanitizeKeys(source.completionFields, DEFAULT_CUSTOMER_FIELD_SETTINGS.completionFields),
    requiredOnEdit: sanitizeKeys(source.requiredOnEdit, DEFAULT_CUSTOMER_FIELD_SETTINGS.requiredOnEdit),
    requiredOnCreate: sanitizeKeys(source.requiredOnCreate, DEFAULT_CUSTOMER_FIELD_SETTINGS.requiredOnCreate),
    actionButtons: sanitizeActionButtons(source.actionButtons),
  };
};
