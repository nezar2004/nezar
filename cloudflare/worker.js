const ALLOWED_ORIGINS = [
  "https://hayati-app-35028.web.app",
  "https://hayati-app-35028.firebaseapp.com",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];
const FIREBASE_API_KEY = "AIzaSyD0aqTFxCsXOROKXaLZE9IV0zGmWCqsKQ8";
const TRIAL_DAYS = 14;
const READ_ONLY_DAYS = 7;


function requestLanguage(request) {
  return request.headers.get("X-Wazen-Language") === "en" ? "en" : "ar";
}
function message(key, language) {
  const en = {
    invalidSession: "Your sign-in session is invalid.",
    notFound: "Route not found.",
    aiExpired: "Your AI access has expired. Subscribe to continue.",
    planExpired: "Your plan creation access has expired. Subscribe to continue.",
    incomplete: "Some required answers are missing.",
    aiUnavailable: "We couldn't reach the AI assistant.",
    noPlan: "No plan was generated.",
    planNotFound: "The plan was not found.",
    translateFailed: "We couldn't translate the plan.",
    translatedMissing: "The translated plan was not returned.",
    buildFailed: "Something went wrong while building the plan."
  };
  const ar = {
    invalidSession: "جلسة تسجيل الدخول غير صالحة.",
    notFound: "المسار غير موجود.",
    aiExpired: "انتهت صلاحية استخدام الذكاء الاصطناعي. اشترك للمتابعة.",
    planExpired: "انتهت صلاحية إنشاء الخطط. اشترك للمتابعة.",
    incomplete: "الإجابات المطلوبة غير مكتملة.",
    aiUnavailable: "تعذر الاتصال بالمساعد الذكي.",
    noPlan: "لم يتم إنشاء خطة.",
    planNotFound: "الخطة غير موجودة.",
    translateFailed: "تعذر ترجمة الخطة.",
    translatedMissing: "لم يتم إرجاع الخطة المترجمة.",
    buildFailed: "حدث خطأ أثناء إنشاء الخطة."
  };
  return (language === "en" ? en : ar)[key];
}

function headers(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Signature",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=UTF-8",
    "Vary": "Origin"
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: headers(origin) });
}
async function verifyFirebase(request) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: authorization.slice(7) })
  });
  if (!response.ok) return null;
  return (await response.json()).users?.[0] || null;
}
function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * 86400000);
}
async function entitlement(user, env) {
  if (user.localId === env.OWNER_UID) return { mode: "owner", plan: "lifetime", daysRemaining: null };
  let record = await env.SUBSCRIPTIONS.get(user.localId, "json");
  if (!record) {
    record = { trialStartedAt: new Date().toISOString(), status: "trial" };
    await env.SUBSCRIPTIONS.put(user.localId, JSON.stringify(record));
  }
  const now = new Date();
  const paidUntil = record.endsAt ? new Date(record.endsAt) : null;
  const paid = ["active", "on_trial"].includes(record.status) ||
    (record.status === "cancelled" && paidUntil && paidUntil > now);
  if (paid) return { mode: "active", plan: record.plan || "pro", currentPeriodEnd: record.endsAt || record.renewsAt || null, daysRemaining: null };
  const trialEnd = addDays(record.trialStartedAt, TRIAL_DAYS);
  const lockAt = addDays(trialEnd, READ_ONLY_DAYS);
  if (now < trialEnd) return { mode: "trial", plan: "trial", trialEndsAt: trialEnd.toISOString(), daysRemaining: Math.ceil((trialEnd - now) / 86400000) };
  if (now < lockAt) return { mode: "read_only", plan: "free", locksAt: lockAt.toISOString(), daysRemaining: Math.ceil((lockAt - now) / 86400000) };
  return { mode: "locked", plan: "free", daysRemaining: 0 };
}
function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function validWebhook(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}
async function webhook(request, env, origin) {
  const raw = await request.text();
  if (!await validWebhook(raw, request.headers.get("X-Signature"), env.LEMONSQUEEZY_WEBHOOK_SECRET)) {
    return json({ error: "Invalid webhook signature" }, 401, origin);
  }
  const payload = JSON.parse(raw);
  const uid = payload.meta?.custom_data?.user_id;
  if (!uid) return json({ received: true, ignored: "missing user_id" }, 200, origin);
  const event = payload.meta?.event_name || "";
  if (!event.startsWith("subscription_")) return json({ received: true }, 200, origin);
  const attributes = payload.data?.attributes || {};
  const previous = await env.SUBSCRIPTIONS.get(uid, "json") || {};
  const record = {
    ...previous,
    status: attributes.status || previous.status,
    plan: attributes.variant_name || previous.plan || "pro",
    subscriptionId: payload.data?.id || previous.subscriptionId,
    renewsAt: attributes.renews_at || previous.renewsAt || null,
    endsAt: attributes.ends_at || attributes.renews_at || previous.endsAt || null,
    updatedAt: new Date().toISOString()
  };
  await env.SUBSCRIPTIONS.put(uid, JSON.stringify(record));
  return json({ received: true }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const language = requestLanguage(request);
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method === "GET" && path === "/") return json({ status: "ok", message: "Wazen AI and billing are working" }, 200, origin);
    if (request.method === "POST" && path === "/billing/webhook") return webhook(request, env, origin);
    const user = await verifyFirebase(request);
    if (!user?.localId) return json({ error: message("invalidSession", language) }, 401, origin);
    const access = await entitlement(user, env);
    if (request.method === "POST" && path === "/billing/status") return json(access, 200, origin);
    if (request.method !== "POST" || !["/", "/plan", "/plan/translate"].includes(path)) return json({ error: message("notFound", language) }, 404, origin);
    if (path === "/plan/translate") {
      if (!["owner", "active", "trial"].includes(access.mode)) return json({ error: message("aiExpired", language), access }, 402, origin);
      try {
        const body = await request.json();
        const targetLanguage = body?.language === "en" ? "en" : "ar";
        const plan = body?.plan;
        if (!plan || typeof plan !== "object") return json({ error: message("planNotFound", language) }, 400, origin);
        const instruction = targetLanguage === "en"
          ? `Translate/rewrite ALL user-facing string values in this Wazen plan into natural, polished English. Do not leave Arabic or mixed-language text. Keep the JSON keys, numbers, arrays, and structure EXACTLY unchanged. Do not add or remove fields.`
          : `حوّل ALL قيم النص الظاهرة للمستخدم في خطة وازن إلى عربية طبيعية واحترافية. لا تترك نصًا إنجليزيًا أو خليطًا لغويًا إلا عند الضرورة مثل أسماء العلامات التجارية. حافظ على مفاتيح JSON والأرقام والمصفوفات والبنية كما هي تمامًا. لا تضف أو تحذف حقولًا.`;
        const prompt = `${instruction}\n\nPLAN JSON:\n${JSON.stringify(plan)}\n\nReturn JSON ONLY.`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${env.GEMINI_API_KEY}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
        });
        if (!response.ok) { console.error(await response.text()); return json({ error: message("translateFailed", language) }, 502, origin); }
        const result = await response.json();
        const output = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!output) return json({ error: message("translatedMissing", language) }, 502, origin);
        return json({ plan: JSON.parse(output), language: targetLanguage, access }, 200, origin);
      } catch (error) { console.error(error); return json({ error: "حدث خطأ أثناء ترجمة الخطة" }, 500, origin); }
    }
    if (!["owner", "active", "trial"].includes(access.mode)) return json({ error: message("planExpired", language), access }, 402, origin);
    try {
      const body = await request.json();
      const answers = body?.answers;
      if (!answers || typeof answers !== "object" || !answers.aiConsent) return json({ error: message("incomplete", language) }, 400, origin);
      const requestedLanguage = body?.language === "en" ? "en" : "ar";
      const languageInstruction = requestedLanguage === "en"
        ? `You are Wazen's global AI life-planning assistant.
ALL user-facing generated content MUST be in English. Do not output Arabic, Arabic labels, Arabic day names, or mixed-language phrases. Use English for every string value including summary, schedule titles/details, meals, foods, workouts, habits, study tasks, and safety notes. Keep JSON keys exactly as specified.`
        : `أنت مساعد وازن الذكي لتخطيط الحياة.
يجب أن تكون ALL المخرجات الظاهرة للمستخدم باللغة العربية فقط. لا تستخدم الإنجليزية داخل قيم النص إلا عند الضرورة القصوى مثل أسماء العلامات التجارية. استخدم العربية في الملخص، الجدول، الوجبات، الأطعمة، التمارين، العادات، مهام الدراسة، وأي ملاحظات. حافظ على مفاتيح JSON كما هي.`;
      const prompt = `${languageInstruction}

حلل البيانات التالية وأنشئ خطة عملية وواقعية تناسب أهداف المستخدم ومواعيده ونومه وميزانيته وطعامه ونشاطه. لا تقدم تشخيصًا طبيًا أو وصفة علاجية.

USER DATA:
${JSON.stringify(answers)}

Return JSON ONLY with exactly this structure:
{"summary":"...","targets":{"calories":2200,"proteinGrams":160,"waterCups":8,"sleepHours":7.5},"dailySchedule":[{"time":"07:30","title":"...","details":"...","category":"personal"}],"meals":[{"name":"...","time":"08:00","foods":"...","calories":500}],"workouts":[{"day":"...","focus":"...","durationMinutes":60,"notes":"..."}],"habits":["..."],"studyPlan":[{"time":"10:00","task":"...","durationMinutes":50}],"safetyNote":"..."}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } })
      });
      if (!response.ok) {
        console.error(await response.text());
        return json({ error: message("aiUnavailable", language) }, 502, origin);
      }
      const result = await response.json();
      const output = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!output) return json({ error: message("noPlan", language) }, 502, origin);
      return json({ plan: JSON.parse(output), access }, 200, origin);
    } catch (error) {
      console.error(error);
      return json({ error: message("buildFailed", language) }, 500, origin);
    }
  }
};
