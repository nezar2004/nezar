const ALLOWED_ORIGINS = [
  "https://hayati-app-35028.web.app",
  "https://hayati-app-35028.firebaseapp.com"
];
const FIREBASE_API_KEY = "AIzaSyD0aqTFxCsXOROKXaLZE9IV0zGmWCqsKQ8";
const TRIAL_DAYS = 14;
const READ_ONLY_DAYS = 7;

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
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method === "GET" && path === "/") return json({ status: "ok", message: "Wazen AI and billing are working" }, 200, origin);
    if (request.method === "POST" && path === "/billing/webhook") return webhook(request, env, origin);
    const user = await verifyFirebase(request);
    if (!user?.localId) return json({ error: "جلسة تسجيل الدخول غير صالحة" }, 401, origin);
    const access = await entitlement(user, env);
    if (request.method === "POST" && path === "/billing/status") return json(access, 200, origin);
    if (request.method !== "POST" || !["/", "/plan"].includes(path)) return json({ error: "المسار غير موجود" }, 404, origin);
    if (!["owner", "active", "trial"].includes(access.mode)) return json({ error: "انتهت صلاحية إنشاء الخطط. اشترك للمتابعة.", access }, 402, origin);
    try {
      const body = await request.json();
      const answers = body?.answers;
      if (!answers || typeof answers !== "object" || !answers.aiConsent) return json({ error: "الإجابات غير مكتملة" }, 400, origin);
      const prompt = `أنت مساعد عربي متخصص في تنظيم الحياة والدراسة والصحة والتمارين والميزانية.
حلل البيانات التالية وأنشئ خطة عملية واقعية باللغة العربية:
${JSON.stringify(answers)}
راعِ المواعيد والنوم والميزانية والطعام والهدف. لا تقدم تشخيصًا طبيًا.
أرجع JSON فقط بهذا البناء:
{"summary":"ملخص","targets":{"calories":2200,"proteinGrams":160,"waterCups":8,"sleepHours":7.5},"dailySchedule":[{"time":"07:30","title":"الاستيقاظ","details":"الاستعداد","category":"personal"}],"meals":[{"name":"الإفطار","time":"08:00","foods":"تفاصيل دقيقة للكميات","calories":500}],"workouts":[{"day":"الأحد","focus":"تمرين","durationMinutes":60,"notes":"تفاصيل"}],"habits":["عادة"],"studyPlan":[{"time":"10:00","task":"مراجعة","durationMinutes":50}],"safetyNote":"خطة تنظيمية وليست وصفة طبية"}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } })
      });
      if (!response.ok) {
        console.error(await response.text());
        return json({ error: "تعذر الاتصال بالمساعد الذكي" }, 502, origin);
      }
      const result = await response.json();
      const output = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!output) return json({ error: "لم يتم إنشاء خطة" }, 502, origin);
      return json({ plan: JSON.parse(output), access }, 200, origin);
    } catch (error) {
      console.error(error);
      return json({ error: "حدث خطأ أثناء إنشاء الخطة" }, 500, origin);
    }
  }
};
