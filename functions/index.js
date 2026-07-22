import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const planSchema = {
  type: "object", additionalProperties: false,
  properties: {
    summary: { type: "string" },
    targets: { type: "object", additionalProperties: false, properties: {
      calories: { type: "integer" }, proteinGrams: { type: "integer" }, waterCups: { type: "integer" }, sleepHours: { type: "number" }
    }, required: ["calories","proteinGrams","waterCups","sleepHours"] },
    dailySchedule: { type: "array", items: { type: "object", additionalProperties: false, properties: { time:{type:"string"}, title:{type:"string"}, details:{type:"string"}, category:{type:"string",enum:["study","work","meal","gym","sleep","personal"]} }, required:["time","title","details","category"] } },
    meals: { type: "array", items: { type: "object", additionalProperties: false, properties: { name:{type:"string"}, time:{type:"string"}, foods:{type:"string"}, calories:{type:"integer"} }, required:["name","time","foods","calories"] } },
    workouts: { type: "array", items: { type: "object", additionalProperties: false, properties: { day:{type:"string"}, focus:{type:"string"}, durationMinutes:{type:"integer"}, notes:{type:"string"} }, required:["day","focus","durationMinutes","notes"] } },
    habits: { type: "array", items: { type: "string" } },
    studyPlan: { type: "array", items: { type: "object", additionalProperties: false, properties: { time:{type:"string"}, task:{type:"string"}, durationMinutes:{type:"integer"} }, required:["time","task","durationMinutes"] } },
    safetyNote: { type: "string" }
  }, required:["summary","targets","dailySchedule","meals","workouts","habits","studyPlan","safetyNote"]
};

export const generateLifePlan = onCall({ region: "us-central1", secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولًا");
  const answers = request.data?.answers;
  if (!answers || typeof answers !== "object") throw new HttpsError("invalid-argument", "بيانات النموذج غير مكتملة");
  const prompt = `أنت مساعد لتنظيم الحياة والصحة. أنشئ خطة عربية عملية ومتوازنة بناءً على إجابات المستخدم التالية:\n${JSON.stringify(answers)}\nراعِ أوقات الدوام والنوم والميزانية. لا تشخّص أمراضًا ولا تقدّم وصفة طبية، واجعل أهداف خسارة الوزن تدريجية وقابلة للتعديل.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY.value()}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema: planSchema } })
  });
  if (!response.ok) throw new HttpsError("internal", `Gemini API error: ${response.status}`);
  const result = await response.json();
  const outputText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!outputText) throw new HttpsError("internal", "لم يُرجع Gemini خطة صالحة");
  const plan = JSON.parse(outputText);
  await db.doc(`users/${request.auth.uid}`).set({ answers, plan, onboardingComplete: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { plan };
});
