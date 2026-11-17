# Pro Smart Field App

## 1) قاعدة البيانات (Supabase → SQL Editor، بالترتيب)
- `sql/step7.sql` (لو لسه ما اتشغلش)
- `sql/step8.sql`: الإشعارات + صرف المخزن
- `sql/step10.sql`: جديد: صلاحيات أمين المخزن + تعديل/حذف الأوامر لإداري معين (وفي آخره سطر تحدد بيه الإداري صاحب الصلاحية)

- `sql/step11.sql` ← جديد: المالك + استلام الأمر + التذكيرات (pg_cron) + سجل العمليات (وفي آخره خطوات إنشاء حساب المالك)

- `sql/step12.sql` ← جديد: منطق المخزن (صرف ← تركيب ← مرتجع) + لقب مهندس

- `sql/step13.sql` ← موافقة أمين المخزن على المرتجعات + زر واتساب
- `sql/step14.sql` ← جديد: الفئات المتداخلة (سمارت هوم > الماركة > النوع...) — بينقل الفئات القديمة لوحده

## 2) تشغيل الإشعارات (مرة واحدة)
1. **Firebase**: console.firebase.google.com → Create project → Add Android app باسم الحزمة `com.prosmart.field` → نزّل `google-services.json`.
2. **GitHub Secret**: في الـ Repo → Settings → Secrets and variables → Actions → New secret
   اسمه `GOOGLE_SERVICES_JSON` وقيمته محتوى ملف `google-services.json` كله.
3. **مفتاح السيرفر**: Firebase → Project settings → Service accounts → Generate new private key (ملف JSON).
4. **Supabase → Edge Functions → Create function** باسم `send-push` والصق محتوى `supabase/functions/send-push/index.ts`.
   ثم Edge Functions → Secrets وأضف:
   - `FIREBASE_SERVICE_ACCOUNT` = محتوى ملف المفتاح (الخطوة 3) كله
   - `WEBHOOK_SECRET` = أي كلمة سر عشوائية طويلة
5. افتح `sql/step9_push_webhook.sql` وغيّر `PUT_A_RANDOM_SECRET_HERE` لنفس `WEBHOOK_SECRET` وشغّله.

## 3) بناء الـ APK
أي Push على `main` (أو Actions → Build Android APK → Run workflow) بيبني APK وينشره في **Releases → latest → ProSmart.apk**.
التحديثات بتتركّب فوق النسخة القديمة (التوقيع ثابت).

## 4) الموقع (GitHub Pages)
Settings → Pages → Source: GitHub Actions. كل Push على main بينشر الموقع.

## تشغيل محلي
npm install && npm run dev

## 5) إعادة تعيين باسورد مستخدم (للمالك بس)
Supabase → Edge Functions → Deploy a new function → اسمها `admin-reset-password` بالظبط → الصق `supabase/functions/admin-reset-password/index.ts` → Deploy. (مفيش Secrets إضافية.)
بعدها في الإعدادات → المستخدمين تلاقي زرار "باسورد" جنب كل مستخدم.

## 6) الأوفلاين
- الفني يفتح أوامره ويشوف تفاصيلها ويسجل وصول/مهام/تقرير/توقيع/صور من غير نت، وكله بيترفع تلقائي لما النت يرجع (شريط أعلى الشاشة بيبين الحالة).
- المخزن والمنتجات والمستخدمين والرسائل لازم نت (عشان الرصيد يفضل سليم).
- أول تسجيل دخول لازم يكون أونلاين.

## 7) المخزن
- الرصيد = الوارد (استلام + مرتجعات) − المصروف لأوامر الشغل.
- الصرف من صفحة "صرف"، والفني بيسجل "ركّبت / مرتجع" من صفحة الأمر، والمرتجع بيرجع للمخزن فورًا.
- الفئات: بتتكتب عند الاستلام (أو من زرار القلم) وبتظهر كأزرار فلترة فوق قايمة المخزن.
- مسح الباركود وQR بالكاميرا (أو كتابة الكود يدوي).

## 8) المظهر
زرار في الهيدر بيبدّل: أزرق (الأساسي) ← داكن ← فاتح.

## 9) التحديث التلقائي للتطبيق
كل Push على `main` بيبني APK جديد وينشره في Release اسمه `latest` (فيه رقم البيلد). التطبيق بيفحص الـ Release عند الفتح وكل ما يرجع للواجهة، ولو في نسخة أحدث بيظهر شريط **"تحديث جديد متوفر — حدّث الآن"**: بينزّل الـ APK ويفتح شاشة التثبيت (ضغطة "تثبيت" واحدة، أندرويد بيفرضها). أول مرة بس هيطلب تسمح للتطبيق بالتثبيت من المصدر ده.
- لازم الـ Repo يكون **Public** (التطبيق بيقرا الـ Release من غير توكن).
- النسخة اللي عليها التحديث الأول لازم تتركّب يدوي مرة (لأن النسخ القديمة مفيهاش الميزة دي).
- زرار "شوف في تحديث" في الإعدادات للفحص اليدوي.
