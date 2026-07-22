import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";

initializeApp();
const db = getFirestore();
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

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

export const generateLifePlan = onCall({ region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولًا");
  const answers = request.data?.answers;
  if (!answers || typeof answers !== "object") throw new HttpsError("invalid-argument", "بيانات النموذج غير مكتملة");
  const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
  const prompt = `أنت مساعد لتنظيم الحياة والصحة. أنشئ خطة عربية عملية ومتوازنة بناءً على إجابات المستخدم التالية:\n${JSON.stringify(answers)}\nراعِ أوقات الدوام والنوم والميزانية. لا تشخّص أمراضًا ولا تقدّم وصفة طبية، واجعل أهداف خسارة الوزن تدريجية وقابلة للتعديل.`;
  const response = await client.responses.create({
    model: "gpt-5.6-terra",
    input: [{ role: "system", content: "أنت مخطط حياة عربي حذر وعملي. أعد JSON مطابقًا للمخطط فقط." }, { role: "user", content: prompt }],
    text: { format: { type: "json_schema", name: "life_plan", strict: true, schema: planSchema } }
  });
  const plan = JSON.parse(response.output_text);
  await db.doc(`users/${request.auth.uid}`).set({ answers, plan, onboardingComplete: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { plan };
});
