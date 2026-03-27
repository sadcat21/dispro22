# Supabase Admin Setup

هذا الملف يجهز المشروع للوصول الإداري إلى Supabase بطريقة أقرب لأسلوب Lovable، لكن مع فصل واضح بين مفاتيح الواجهة الأمامية والمفاتيح الإدارية.

## 1. متغيرات البيئة

انسخ القيم المطلوبة إلى `.env` أو إلى أسرار Vercel/Supabase:

```env
VITE_SUPABASE_PROJECT_ID=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ACCESS_TOKEN=...
SUPABASE_INTERNAL_ADMIN_SECRET=...
```

مهم:
- `VITE_*` يمكن استخدامها في الواجهة.
- `SUPABASE_SERVICE_ROLE_KEY` و `SUPABASE_INTERNAL_ADMIN_SECRET` لا يجب وضعهما داخل `src/`.

## 2. الملفات المشتركة

تمت إضافة ملفات مشتركة لإعادة الاستخدام:

- `supabase/functions/_shared/admin.ts`
- `supabase/functions/_shared/cors.ts`

هذه الملفات تعطيك:
- عميل إداري جاهز باستخدام `SUPABASE_SERVICE_ROLE_KEY`
- حماية بسيطة عبر `x-admin-secret`
- ردود JSON و CORS موحدة

## 3. وظيفة جاهزة كبداية

تمت إضافة:

- `supabase/functions/admin-maintenance/index.ts`

الوظيفة تدعم حاليًا:
- `ping`
- `get_setting`
- `upsert_setting`

مثال طلب:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/admin-maintenance" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_INTERNAL_SECRET" \
  -d "{\"action\":\"ping\"}"
```

مثال قراءة إعداد:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/admin-maintenance" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_INTERNAL_SECRET" \
  -d "{\"action\":\"get_setting\",\"payload\":{\"key\":\"app_min_version\"}}"
```

مثال تعديل/إضافة إعداد:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/admin-maintenance" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_INTERNAL_SECRET" \
  -d "{\"action\":\"upsert_setting\",\"payload\":{\"key\":\"app_min_version\",\"value\":\"2\"}}"
```

## 4. كيف نضيف وظائف جديدة بنفس الأسلوب

عند إنشاء Function جديدة:

1. ابدأ من `supabase/functions/admin-maintenance/index.ts`
2. استورد:

```ts
import { createAdminClient, requireAdminSecret } from "../_shared/admin.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
```

3. داخل `serve(...)`:
- نفذ `handleCors(req)`
- نفذ `requireAdminSecret(req)`
- أنشئ العميل عبر `createAdminClient()`
- نفذ العملية الإدارية المطلوبة

## 5. المراحل القادمة

لاحقًا يمكننا توسيع هذا الأساس إلى:
- قراءة وتعديل أي جدول محدد
- تنفيذ workflows إدارية مجمعة
- إنشاء قوالب Functions للعمال/الإدارة
- ربطها بزر داخل لوحة الإدارة بدل `curl`
