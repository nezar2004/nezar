# حياتي مرتبة

نسخة نظيفة تستخدم Firebase Authentication وFirestore وHosting، وتتصل بخدمة الذكاء الاصطناعي عبر Cloudflare Worker.

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
