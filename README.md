# وازن

وازن — خطتك الذكية للدراسة والتغذية والرياضة وتنظيم الحياة. يستخدم Firebase Authentication وFirestore وHosting، ويتصل بخدمة الذكاء الاصطناعي عبر Cloudflare Worker.

## الملفات

- `public/index.html`: واجهة التطبيق.
- `public/styles.css`: التصميم.
- `public/app.js`: تسجيل الدخول، الأسئلة، لوحة التحكم وربط الذكاء الاصطناعي.
- `firestore.rules`: حماية بيانات كل مستخدم.
- `firebase.json`: إعداد Hosting وFirestore فقط.

## إعداد Firebase

في مشروع `hayati-app-35028`:

1. فعّل Email/Password وGoogle من Authentication.
2. تأكد من وجود `hayati-app-35028.web.app` و`hayati-app-35028.firebaseapp.com` في Authorized domains.
3. أنشئ Firestore Database.

## النشر المجاني

```bash
firebase use hayati-app-35028
firebase deploy --only hosting,firestore:rules
```

لا تحتاج Firebase Functions أو خطة Blaze. مفتاح Gemini يبقى محفوظًا كـ Secret في Cloudflare Worker ولا يوضع داخل ملفات الموقع.
# اشتراكات وازن

النسخة الحالية تدعم دورة الوصول التالية:

- 14 يومًا تجربة كاملة.
- 7 أيام مشاهدة فقط.
- قفل لوحة التحكم بعد 21 يومًا حتى يتم الاشتراك.
- اشتراك شهري بقيمة 5.99 د.أ.
- اشتراك سنوي بقيمة 49.99 د.أ.
- حساب المالك يحصل على وصول دائم.

## إعداد Cloudflare Worker

استخدم الملف `cloudflare/worker.js` بدل كود Worker الحالي، ثم أضف:

1. KV Namespace باسم `WAZEN_SUBSCRIPTIONS` واربطه بالـWorker باسم المتغير `SUBSCRIPTIONS`.
2. Variable باسم `OWNER_UID` وقيمته UID حساب المالك.
3. Secret باسم `GEMINI_API_KEY`.
4. Secret باسم `LEMONSQUEEZY_WEBHOOK_SECRET`.

## إعداد Lemon Squeezy Webhook

أنشئ Webhook بعنوان:

`https://hayati-ai.nezarcaht.workers.dev/billing/webhook`

واختر الأحداث:

- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_expired`

استخدم Signing Secret قويًا، وضع القيمة نفسها في Secret الخاص بالـWorker. لا تضع السر داخل GitHub أو ملفات الواجهة.
