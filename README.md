# حياتي مرتبة — النسخة الكاملة

## 1. تفعيل خدمات Firebase

من Firebase Console للمشروع `hayati-app-35028`:

1. Authentication → Sign-in method: فعّل Email/Password وGoogle.
2. Firestore Database → Create database.
3. أضف نطاق الاستضافة إلى Authorized domains عند الحاجة.

## 2. تثبيت الأدوات

```bash
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
```

## 3. حفظ مفتاح Gemini بأمان

لا تضع المفتاح داخل `public/app.js`. نفّذ:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

ثم الصق المفتاح داخل الطرفية فقط عند الطلب.

## 4. النشر

```bash
firebase deploy
```

قد يتطلب نشر Cloud Functions تفعيل خطة Blaze في Firebase. استخدام Gemini API يخضع للحصة والتسعير في Google AI Studio.

## الملفات

- `public/`: صفحات تسجيل الدخول، الأسئلة ولوحة المستخدم.
- `functions/index.js`: تحليل الإجابات بالذكاء الاصطناعي وحفظ الخطة.
- `firestore.rules`: حماية بيانات كل مستخدم.
- `firebase.json`: إعداد الاستضافة والوظائف وقاعدة البيانات.
