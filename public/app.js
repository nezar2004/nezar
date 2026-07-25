import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const config={apiKey:"AIzaSyD0aqTFxCsXOROKXaLZE9IV0zGmWCqsKQ8",authDomain:"hayati-app-35028.firebaseapp.com",projectId:"hayati-app-35028",storageBucket:"hayati-app-35028.firebasestorage.app",messagingSenderId:"216794693163",appId:"1:216794693163:web:e864c50ad01fde5f1ab46e"};
const AI_ENDPOINT="https://hayati-ai.nezarcaht.workers.dev";
const CHECKOUT_URLS={
  monthly:"https://wazen-app.lemonsqueezy.com/checkout/buy/102e218e-2444-42ea-b191-e73e9d9ea716",
  yearly:"https://wazen-app.lemonsqueezy.com/checkout/buy/4c54ca78-8aef-4436-a585-f3408a283b4e"
};
// ارفع هذا الرقم فقط عندما يحتاج التحديث إلى إعادة تعبئة بيانات جميع المستخدمين.
const PROFILE_VERSION=5;
const DEFAULT_WORKOUT_SPLIT=[
  {day:"اليوم الأول",focus:"صدر وترايسبس",exercises:[
    ["Machine Chest Press","جهاز ضغط الصدر","الصدر",4,"8-12",90],
    ["Incline Chest Press Machine","جهاز ضغط الصدر العلوي","الصدر العلوي",4,"8-12",90],
    ["Pec Deck Machine","جهاز تفتيح الصدر","الصدر",3,"12-15",60],
    ["Cable Crossover","جهاز الكيبل","الصدر",3,"12-15",60],
    ["Assisted Chest Dips","جهاز المتوازي المساعد","الصدر",3,"8-12",75],
    ["Rope Pushdown","دفع الحبل للأسفل","الترايسبس",3,"10-15",60],
    ["Overhead Cable Extension","تمديد فوق الرأس بالكيبل","الترايسبس",3,"10-12",60],
    ["Triceps Dip Machine","جهاز غطس الترايسبس","الترايسبس",3,"8-12",75]
  ]},
  {day:"اليوم الثاني",focus:"ظهر وبايسبس",exercises:[
    ["Lat Pulldown","جهاز السحب الأمامي","الظهر",4,"8-12",90],
    ["Seated Cable Row","التجديف جالسًا بالكيبل","الظهر",4,"8-12",90],
    ["Chest Supported Row Machine","جهاز تجديف مع تثبيت الصدر","الظهر",3,"10-12",75],
    ["Single Arm Cable Row","سحب كيبل بذراع واحدة","الظهر",3,"10-12",60],
    ["Straight Arm Pulldown","سحب كيبل بذراع مستقيمة","الظهر",3,"12-15",60],
    ["Preacher Curl Machine","جهاز بايسبس الواعظ","البايسبس",3,"8-12",60],
    ["Cable Curl","بايسبس بالكيبل","البايسبس",3,"10-12",60],
    ["Dumbbell Hammer Curl","هامر بالدمبل","البايسبس",3,"10-12",60]
  ]},
  {day:"اليوم الثالث",focus:"أكتاف وترابيس وسواعد",exercises:[
    ["Shoulder Press Machine","جهاز ضغط الكتف","الأكتاف",4,"8-12",90],
    ["Lateral Raise Machine","جهاز الرفرفة الجانبية","الكتف الجانبي",4,"12-15",60],
    ["Reverse Pec Deck","جهاز الكتف الخلفي","الكتف الخلفي",3,"12-15",60],
    ["Cable Front Raise","رفرفة أمامية بالكيبل","الكتف الأمامي",3,"10-12",60],
    ["Cable Face Pull","سحب الحبل نحو الوجه","الكتف الخلفي",3,"12-15",60],
    ["Shrug Machine","جهاز هز الكتف","الترابيس",4,"10-15",75],
    ["Seated Wrist Curl","لف الرسغ بالدمبل","السواعد",3,"15-20",45],
    ["Reverse Wrist Curl","لف الرسغ العكسي","السواعد",3,"15-20",45],
    ["Reverse Cable Curl","بايسبس عكسي بالكيبل","السواعد",3,"12-15",60]
  ]},
  {day:"اليوم الرابع",focus:"أرجل وبطن",exercises:[
    ["Hack Squat Machine","جهاز الهاك سكوات","الأرجل",4,"8-12",120],
    ["Leg Press","جهاز ضغط الأرجل","الأرجل",4,"10-15",90],
    ["Leg Curl Machine","جهاز ثني الأرجل الخلفية","خلفية الفخذ",4,"10-15",75],
    ["Standing Calf Raise Machine","جهاز السمانة","السمانة",4,"12-20",60],
    ["Cable Crunch","كرنش بالكيبل","البطن",3,"12-20",45],
    ["Captain's Chair Knee Raise","جهاز رفع الركبتين","البطن",3,"10-15",45]
  ]}
].map(day=>({...day,exercises:day.exercises.map(([englishName,machine,muscle,sets,reps,restSeconds])=>({name:`${machine} — ${englishName}`,machine,muscle,sets,reps,restSeconds,notes:"استخدم وزنًا يسمح بأداء صحيح وتحكم كامل بالحركة"}))}));
const fb=initializeApp(config),auth=getAuth(fb),db=getFirestore(fb);
const persistenceReady=setPersistence(auth,browserSessionPersistence);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const screens=["#loader","#auth","#onboarding","#analyzing","#subscription","#dashboard"];
const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today=()=>dateKey();
const id=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const friendlyError=v=>String(v||"حدث خطأ غير متوقع").replace(/Firebase/gi,"الخدمة").replace(/Cloudflare/gi,"الخدمة").replace(/Gemini/gi,"المساعد الذكي");
let mode="login",step=0,currentUser=null,userData={},answers={},view="home",calendarDate=new Date(),modalState=null,expandedWorkout=null,authBootChecked=false,billing={mode:"loading",daysRemaining:0};

const emptyWorkspace=()=>({
  events:[],courses:[],tasks:[],habits:[
    {id:id(),name:"شرب الماء",target:8,unit:"كوب",value:0,date:today()},
    {id:id(),name:"الدراسة",target:3,unit:"جلسات",value:0,date:today()}
  ],
  expenses:[],progress:[],notes:[],mealChecks:{},workoutChecks:{}
});
function workspace(){userData.workspace={...emptyWorkspace(),...(userData.workspace||{})};return userData.workspace}
function show(target){screens.forEach(x=>$(x).classList.add("hidden"));$(target).classList.remove("hidden")}
function toast(text){const x=$("#toast");x.textContent=text;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
async function saveData(){await setDoc(doc(db,"users",currentUser.uid),{workspace:userData.workspace},{merge:true})}
function formatDate(d){return new Intl.DateTimeFormat("ar-JO",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${d}T12:00:00`))}
function money(n){return `${Number(n||0).toFixed(2)} د.أ`}
const canEdit=()=>["owner","active","trial"].includes(billing.mode);
async function loadBilling(){
  const token=await currentUser.getIdToken(true);
  const response=await fetch(`${AI_ENDPOINT}/billing/status`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.mode)throw new Error(result.error||"تعذر التحقق من حالة الاشتراك");
  billing=result;
  return result;
}
function checkoutUrl(planName){
  const url=new URL(CHECKOUT_URLS[planName]);
  url.searchParams.set("checkout[custom][user_id]",currentUser.uid);
  if(currentUser.email)url.searchParams.set("checkout[email]",currentUser.email);
  return url.toString();
}
function showSubscription(message){
  show("#subscription");
  $("#subscriptionMessage").textContent=message||"انتهت فترة الوصول إلى حسابك. اشترك للعودة إلى خطتك وبياناتك.";
  const showTrial=billing.mode==="trial";
  $("#trialPricingCard").classList.toggle("hidden",!showTrial);
  if(showTrial)$("#trialPlanButton").textContent=`تجربتك فعّالة • بقي ${billing.daysRemaining||0} يومًا`;
}

onAuthStateChanged(auth,async user=>{
  if(!authBootChecked){
    authBootChecked=true;
    const started=sessionStorage.getItem("wazen-session-started")==="1";
    sessionStorage.setItem("wazen-session-started","1");
    if(user&&!started){await signOut(auth);show("#auth");return}
  }
  currentUser=user;
  if(!user)return show("#auth");
  try{
    const snap=await getDoc(doc(db,"users",user.uid));
    userData=snap.exists()?snap.data():{};
    await loadBilling();
    if(snap.exists()&&Number(userData.profileVersion||0)<PROFILE_VERSION){
      await setDoc(doc(db,"users",user.uid),{onboardingComplete:false,profileVersion:PROFILE_VERSION,answers:{}},{merge:true});
      await signOut(auth);
      show("#auth");
      $("#authError").textContent="تم تحديث التطبيق. سجّل الدخول مجددًا ثم عبّئ بياناتك الجديدة.";
      return;
    }
    workspace();
    if(billing.mode==="locked")return showSubscription("انتهت التجربة وفترة المشاهدة. بياناتك محفوظة وستعود كاملة فور الاشتراك.");
    if(billing.mode==="read_only"&&!(userData.onboardingComplete&&userData.plan))return showSubscription("انتهت التجربة قبل إنشاء خطتك. اشترك للمتابعة وإنشاء خطة شخصية.");
    if(userData.onboardingComplete&&userData.plan){show("#dashboard");renderDashboard("home")}
    else{show("#onboarding");renderStep()}
  }catch(e){console.error(e);show("#auth");$("#authError").textContent=`تعذر تحميل الحساب: ${e.code||e.message}`}
});

$$("[data-auth-tab]").forEach(b=>b.onclick=()=>{
  mode=b.dataset.authTab;
  $$("[data-auth-tab]").forEach(x=>x.classList.toggle("active",x===b));
  $(".signup-only").classList.toggle("hidden",mode!=="signup");
  $("#authSubmit").textContent=mode==="signup"?"إنشاء الحساب":"تسجيل الدخول";
});
$("#authForm").onsubmit=async e=>{
  e.preventDefault();$("#authError").textContent="";
  try{
    await persistenceReady;
    if(mode==="signup"){
      const c=await createUserWithEmailAndPassword(auth,$("#email").value,$("#password").value);
      await updateProfile(c.user,{displayName:$("#name").value});
      await setDoc(doc(db,"users",c.user.uid),{name:$("#name").value,email:c.user.email,onboardingComplete:false,profileVersion:PROFILE_VERSION,workspace:emptyWorkspace()});
    }else await signInWithEmailAndPassword(auth,$("#email").value,$("#password").value);
  }catch(e){$("#authError").textContent=`تعذر تسجيل الدخول: ${e.code||e.message}`}
};
$("#googleLogin").onclick=async()=>{try{$("#authError").textContent="";await persistenceReady;await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){$("#authError").textContent=`تعذر تسجيل Google: ${e.code||e.message}`}};
$("#resetPassword").onclick=()=>{
  $("#resetEmail").value=$("#email").value.trim();
  $("#resetStatus").classList.add("hidden");
  $("#resetForm").classList.remove("hidden");
  $("#resetEmail").focus();
};
$("#closeReset").onclick=()=>$("#resetForm").classList.add("hidden");
$("#resetForm").onsubmit=async e=>{
  e.preventDefault();
  const email=$("#resetEmail").value.trim().toLowerCase(),button=$("#sendReset"),status=$("#resetStatus");
  if(!$("#resetEmail").checkValidity()){ $("#resetEmail").reportValidity();return }
  button.disabled=true;button.textContent="جاري الإرسال...";
  status.className="reset-status hidden";
  try{
    await sendPasswordResetEmail(auth,email,{url:"https://hayati-app-35028.web.app"});
    status.className="reset-status success";
    status.innerHTML=`<b>أرسلنا رابط الاستعادة إلى:</b><span dir="ltr">${esc(email)}</span><small>تحقق من البريد الوارد أو غير المرغوب فيه، ثم استخدم الرابط لتعيين كلمة مرور جديدة.</small>`;
  }catch(error){
    const messages={"auth/invalid-email":"صيغة البريد الإلكتروني غير صحيحة.","auth/too-many-requests":"تمت محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.","auth/network-request-failed":"تعذر الاتصال بالإنترنت. تحقق من الشبكة وحاول مجددًا."};
    status.className="reset-status failure";
    status.textContent=messages[error.code]||`تعذر إرسال الرابط: ${error.code||error.message}`;
  }finally{
    button.disabled=false;button.textContent="إرسال رابط الاستعادة";
  }
};

const roleOptions=[
  ["school","طالب مدرسة","الدروس والواجبات والاختبارات المدرسية","▣"],
  ["university","طالب جامعي","المواد والمحاضرات والكويزات والمشاريع","🎓"],
  ["employee","موظف","الدوام والمهام والأهداف المهنية","▦"],
  ["jobseeker","أبحث عن عمل","تنظيم اليوم والمهارات وخطة البحث عن فرصة","◎"]
];
const activeAnswers=()=>Object.keys(answers||{}).length?answers:(userData?.answers||{});
const hasRole=role=>(activeAnswers().roles||[]).includes(role);
const isStudying=()=>hasRole("school")||hasRole("university")||(hasRole("jobseeker")&&activeAnswers().stillStudying&&activeAnswers().stillStudying!=="لا أدرس حاليًا");
const hasWorkContext=()=>hasRole("employee")||hasRole("jobseeker");
const isTraining=()=>activeAnswers().trainingType!=="لا أتمرن حاليًا"&&Number(activeAnswers().trainingDays??1)>0;
function contextQuestions(){
  const blocks=[];
  if(hasRole("school"))blocks.push(`<div class="context-block"><h3>بيانات المدرسة</h3><div class="fields"><label>الصف الدراسي<input id="schoolGrade" value="${answers.schoolGrade||""}" placeholder="مثال: الحادي عشر"></label><label>مواعيد المدرسة<input id="schoolSchedule" value="${answers.schoolSchedule||""}" placeholder="الأحد–الخميس، 8:00–2:00"></label><label>المواد الحالية<textarea id="schoolSubjects">${answers.schoolSubjects||""}</textarea></label><label>أقرب اختبارات أو واجبات<textarea id="schoolDeadlines">${answers.schoolDeadlines||""}</textarea></label></div></div>`);
  if(hasRole("university"))blocks.push(`<div class="context-block"><h3>بيانات الجامعة</h3><div class="fields"><label>التخصص<input id="major" value="${answers.major||""}"></label><label>السنة الدراسية<input id="universityYear" value="${answers.universityYear||""}" placeholder="الأولى، الثانية..."></label><label>جدول الجامعة<textarea id="schedule" placeholder="الأحد من 8:30 إلى 3:20...">${answers.schedule||""}</textarea></label><label>المواد الحالية<textarea id="courses">${answers.courses||""}</textarea></label><label>نظام الامتحانات<select id="examSystem"><option>First + Second + Final</option><option>Mid + Final</option><option>كويزات + Mid + Final</option><option>نظام آخر</option></select></label><label>أقرب امتحانات أو مشاريع<textarea id="academicDeadlines">${answers.academicDeadlines||""}</textarea></label></div></div>`);
  if(hasRole("employee"))blocks.push(`<div class="context-block"><h3>بيانات العمل</h3><div class="fields"><label>المسمى الوظيفي<input id="jobTitle" value="${answers.jobTitle||""}"></label><label>أيام العمل<input id="workDays" value="${answers.workDays||""}" placeholder="الأحد–الخميس"></label><label>ساعات الدوام<input id="workSchedule" value="${answers.workSchedule||""}" placeholder="9:00–5:00"></label><label>أهم أهدافك في العمل<textarea id="workGoals">${answers.workGoals||""}</textarea></label></div></div>`);
  if(hasRole("jobseeker"))blocks.push(`<div class="context-block"><h3>البحث عن عمل</h3><div class="fields"><label>هل ما زلت تدرس؟<select id="stillStudying"><option>لا أدرس حاليًا</option><option>أدرس في المدرسة</option><option>أدرس في الجامعة</option><option>أتعلم بشكل ذاتي</option></select></label><label>العمل الذي تبحث عنه<input id="desiredJob" value="${answers.desiredJob||""}"></label><label>مهاراتك الحالية<textarea id="jobSkills">${answers.jobSkills||""}</textarea></label><label>وقت يومي للبحث والتطوير<input id="jobSearchHours" type="number" min="0" max="12" step=".5" value="${answers.jobSearchHours||2}"></label></div></div>`);
  if(!blocks.length)blocks.push(`<div class="context-block"><h3>روتينك الحالي</h3><label>صف يومك المعتاد<textarea id="dailyRoutine">${answers.dailyRoutine||""}</textarea></label></div>`);
  return blocks.join("");
}
const steps=[
  {title:"ما وضعك الحالي؟",desc:"اختر خيارًا أو خيارين حتى نعرض لك ما يناسب حياتك فقط.",html:()=>`<div class="role-grid">${roleOptions.map(([key,title,desc,icon])=>`<button class="role-option ${hasRole(key)?"selected":""}" data-role="${key}"><i>${icon}</i><span><b>${title}</b><small>${desc}</small></span><em>${hasRole(key)?"✓":""}</em></button>`).join("")}</div><p class="selection-hint">يمكنك اختيار حالتين، مثل: طالب جامعي وموظف.</p>`},
  {title:"بيانات الجسم الأساسية",desc:"نستخدمها لتقدير الاحتياج اليومي بشكل مناسب.",html:()=>`<div class="fields"><label>العمر<input id="age" type="number" min="16" max="90" required value="${answers.age||""}"></label><label>الطول (سم)<input id="height" type="number" min="120" max="230" required value="${answers.height||""}"></label><label>الوزن الحالي (كغم)<input id="weight" type="number" min="35" max="300" required step=".1" value="${answers.weight||""}"></label><label>الوزن المستهدف (كغم)<input id="targetWeight" type="number" min="35" max="300" required step=".1" value="${answers.targetWeight||""}"></label><label>محيط الخصر (اختياري)<input id="waist" type="number" min="40" max="220" step=".1" value="${answers.waist||""}"></label><label>الجنس<select id="gender"><option value="male">ذكر</option><option value="female">أنثى</option></select></label><label>مستوى النشاط<select id="activityLevel"><option>قليل الحركة</option><option>نشاط خفيف</option><option>نشاط متوسط</option><option>نشاط مرتفع</option></select></label><label>المدة المرغوبة للوصول للهدف<select id="goalPace"><option>بشكل تدريجي وآمن</option><option>بدون موعد محدد</option><option>خلال 3 أشهر</option><option>خلال 6 أشهر</option></select></label></div>`},
  {title:"ما هدفك؟",desc:"هذا الاختيار يغيّر السعرات والماكروز وحجم الوجبات.",html:()=>`<div class="option-grid">${["تنشيف","تضخيم","تثبيت الوزن","تنظيم الحياة"].map(x=>`<button class="option ${answers.goal===x?"selected":""}" data-goal="${x}">${x}</button>`).join("")}</div><p class="muted">${answers.goal?`اختيارك الحالي: ${answers.goal}`:"اختر هدفًا للمتابعة"}</p>`},
  {title:"النوم والاستيقاظ",desc:"سنرتب يومك حولهما.",html:()=>`<div class="fields"><label>وقت النوم<input id="sleep" type="time" value="${answers.sleep||"00:00"}"></label><label>وقت الاستيقاظ<input id="wake" type="time" value="${answers.wake||"07:30"}"></label></div>`},
  {title:"دراستك وعملك",desc:"نعرض هذه الأسئلة بناءً على اختيارك في البداية.",html:contextQuestions},
  {title:"تفضيلات النظام الغذائي",desc:"لنقترح وجبات يمكنك الالتزام بها فعلًا.",html:()=>`<div class="fields"><label>نوع الغذاء<select id="dietType"><option>عادي</option><option>نباتي</option><option>قليل الكربوهيدرات</option><option>بدون ألبان</option><option>بدون جلوتين</option></select></label><label>عدد الوجبات يوميًا<input id="mealsPerDay" type="number" min="2" max="6" value="${answers.mealsPerDay||3}"></label><label>ميزانية الطعام اليومية (د.أ)<input id="foodBudget" type="number" min="0" step=".1" value="${answers.foodBudget||0}"></label><label>إمكانية الطبخ<select id="cookingAccess"><option>أستطيع الطبخ يوميًا</option><option>طبخ بسيط وسريع</option><option>أعتمد غالبًا على الطعام الجاهز</option></select></label><label>أكلات تحبها<textarea id="liked">${answers.liked||""}</textarea></label><label>أكلات لا تحبها<textarea id="disliked" placeholder="اكتب لا يوجد إذا لم تكره أطعمة معينة">${answers.disliked||""}</textarea></label><label class="full">الحساسية أو القيود الصحية المتعلقة بالطعام<textarea id="allergies" placeholder="اكتب لا يوجد إذا لم يكن لديك شيء">${answers.allergies||""}</textarea></label><label>المكملات المستخدمة (اختياري)<input id="supplements" value="${answers.supplements||""}" placeholder="مثل: بروتين"></label></div>`},
  {title:"التمارين والحركة",desc:"نربط الغذاء بنشاطك الحالي بدقة.",html:()=>{
    const noTraining=answers.trainingType==="لا أتمرن حاليًا";
    return `<div class="fields training-fields"><label class="full">هل تتمرن حاليًا؟<select id="trainingType"><option>حديد</option><option>كارديو</option><option>حديد وكارديو</option><option>تمارين منزلية</option><option>لا أتمرن حاليًا</option></select></label>${noTraining?`<div class="no-training-message full"><i>✓</i><div><b>تمام، لن نضيف برنامج تمارين</b><small>سنركّز على التغذية والنوم والحركة اليومية الخفيفة، ويمكنك تغيير هذا الخيار لاحقًا.</small></div></div>`:`<label>أيام التمرين أسبوعيًا<input id="trainingDays" type="number" min="1" max="7" value="${answers.trainingDays||3}"></label><label>وقت التمرين المناسب<input id="trainingTime" type="time" value="${answers.trainingTime||"17:00"}"></label><label>مدة الحصة بالدقائق<input id="trainingDuration" type="number" min="15" max="180" value="${answers.trainingDuration||60}"></label><label>إصابات أو قيود حركية<textarea id="injuries" placeholder="اكتب لا يوجد إذا لم يكن لديك شيء">${answers.injuries||""}</textarea></label>`}</div>`;
  }},
  {title:"المهام والعادات",desc:"ما الذي تريد إنجازه باستمرار؟",html:()=>`<div class="fields"><label>المهام الأساسية<textarea id="tasks">${answers.tasks||""}</textarea></label><label>العادات اليومية<textarea id="habits">${answers.habits||""}</textarea></label></div>`},
  {title:"الميزانية والملاحظات",desc:"آخر خطوة.",html:()=>`<div class="fields"><label>الدخل اليومي<input id="income" type="number" min="0" step=".1" value="${answers.income??0}"></label><label>المصروف اليومي<input id="expenses" type="number" min="0" step=".1" value="${answers.expenses??0}"></label></div><label>ملاحظات إضافية (اختياري)<textarea id="notes">${answers.notes||""}</textarea></label><label style="display:flex;grid-template-columns:auto 1fr;gap:10px;margin-top:18px;line-height:1.7"><input id="aiConsent" type="checkbox" required style="width:18px" ${answers.aiConsent?"checked":""}><span>أوافق على استخدام إجاباتي لإنشاء خطتي الشخصية. لن تُستخدم كلمة المرور أو تُرسل ضمن التحليل.</span></label>`}
];
const optionalOnboardingFields=new Set(["waist","supplements","notes"]);
function showStepError(message,field){
  let error=$("#stepError");
  if(!error){
    error=document.createElement("div");
    error.id="stepError";
    error.className="step-error";
    $("#questionBody").append(error);
  }
  error.textContent=message;
  if(field){
    field.classList.add("field-error");
    field.setAttribute("aria-invalid","true");
    field.scrollIntoView({behavior:"smooth",block:"center"});
    setTimeout(()=>field.focus(),250);
  }
}
function validateCurrentStep(){
  $("#stepError")?.remove();
  $$("#questionBody input,#questionBody textarea,#questionBody select").forEach(el=>{el.classList.remove("field-error");el.removeAttribute("aria-invalid")});
  if(step===0&&!(answers.roles||[]).length){showStepError("اختر وضعك الحالي للمتابعة.");return false}
  if(step===2&&!answers.goal){showStepError("اختر هدفك للمتابعة.");return false}
  const fields=$$("#questionBody input,#questionBody textarea,#questionBody select");
  for(const field of fields){
    if(optionalOnboardingFields.has(field.id)||field.disabled)continue;
    const empty=field.type==="checkbox"?!field.checked:String(field.value??"").trim()==="";
    if(empty||!field.checkValidity()){
      const label=field.closest("label")?.childNodes?.[0]?.textContent?.trim()||"هذا الحقل";
      showStepError(`أكمل حقل «${label}» بشكل صحيح قبل المتابعة.`,field);
      return false;
    }
  }
  return true;
}
function renderStep(){
  $("#stepLabel").textContent=`الخطوة ${step+1} من ${steps.length}`;
  $("#progressBar").style.width=`${(step+1)/steps.length*100}%`;
  $("#questionBody").innerHTML=`<h1>${steps[step].title}</h1><p>${steps[step].desc}</p>${steps[step].html()}`;
  $("#prevStep").style.visibility=step?"visible":"hidden";
  $("#nextStep").textContent=step===steps.length-1?"✦ إنشاء خطتي":"التالي";
  ["gender","activityLevel","goalPace","dietType","cookingAccess","trainingType","examSystem","stillStudying"].forEach(k=>{if($("#"+k)&&answers[k])$("#"+k).value=answers[k]});
}
function collect(){
  ["age","height","weight","targetWeight","waist","gender","activityLevel","goalPace","sleep","wake","schedule","schoolGrade","schoolSchedule","schoolSubjects","schoolDeadlines","major","universityYear","courses","examSystem","academicDeadlines","jobTitle","workDays","workSchedule","workGoals","stillStudying","desiredJob","jobSkills","jobSearchHours","dailyRoutine","dietType","mealsPerDay","foodBudget","cookingAccess","liked","disliked","allergies","supplements","trainingDays","trainingTime","trainingType","trainingDuration","injuries","studyHoursTarget","tasks","habits","income","expenses","notes"].forEach(k=>{const el=$("#"+k);if(el)answers[k]=el.type==="number"?Number(el.value):el.value});
  if($("#aiConsent"))answers.aiConsent=$("#aiConsent").checked;
  if(answers.trainingType==="لا أتمرن حاليًا"){
    answers.trainingDays=0;
    delete answers.trainingTime;
    delete answers.trainingDuration;
    delete answers.injuries;
  }
}
document.addEventListener("click",e=>{
  const roleButton=e.target.closest("[data-role]");
  if(roleButton){
    const role=roleButton.dataset.role,current=[...(answers.roles||[])],exists=current.includes(role);
    if(exists)answers.roles=current.filter(x=>x!==role);
    else{
      let next=current;
      if(role==="school")next=next.filter(x=>x!=="university");
      if(role==="university")next=next.filter(x=>x!=="school");
      if(next.length>=2)return toast("يمكنك اختيار حالتين فقط");
      answers.roles=[...next,role];
    }
    renderStep();return;
  }
  if(e.target.dataset.goal){answers.goal=e.target.dataset.goal;renderStep()}
});
document.addEventListener("change",e=>{
  if(e.target.id==="trainingType"){
    answers.trainingType=e.target.value;
    if(answers.trainingType==="لا أتمرن حاليًا")answers.trainingDays=0;
    renderStep();
  }
});
document.addEventListener("input",e=>{
  if(e.target.matches("#questionBody input,#questionBody textarea,#questionBody select")){
    e.target.classList.remove("field-error");
    e.target.removeAttribute("aria-invalid");
    $("#stepError")?.remove();
  }
});
$("#nextStep").onclick=async()=>{if(!validateCurrentStep())return;collect();if(step<steps.length-1){step++;renderStep()}else await generatePlan()};
$("#prevStep").onclick=()=>{collect();step--;renderStep()};
async function generatePlan(){
  if(!canEdit())return showSubscription("هذه الميزة تحتاج اشتراكًا فعالًا.");
  show("#analyzing");
  try{
    const token=await currentUser.getIdToken(true);
    const planAnswers=isTraining()
      ?{...answers,workoutTemplate:DEFAULT_WORKOUT_SPLIT,workoutInstructions:"التزم بهذه التقسيمة وأعداد التمارين والجولات والتكرارات والأجهزة. عدّل التمرين فقط عند وجود إصابة أو عدم توفر جهاز، ولا تقترح أوزانًا قصوى."}
      :{...answers,trainingDays:0,workoutInstructions:"المستخدم لا يتمرن حاليًا. لا تنشئ برنامج تمارين، ولا تقترح أجهزة أو جولات. اكتفِ بحركة يومية خفيفة اختيارية وآمنة."};
    const response=await fetch(AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({answers:planAnswers})});
    const result=await response.json();
    if(!response.ok||!result.plan)throw new Error(result.error||"تعذر إنشاء الخطة");
    await setDoc(doc(db,"users",currentUser.uid),{answers,plan:result.plan,onboardingComplete:true,profileVersion:PROFILE_VERSION},{merge:true});
    userData={...userData,answers,plan:result.plan,onboardingComplete:true,profileVersion:PROFILE_VERSION};show("#dashboard");renderDashboard("home");
  }catch(e){console.error(e);show(userData.plan?"#dashboard":"#onboarding");if(userData.plan)renderDashboard(view);alert(`تعذر إنشاء الخطة: ${friendlyError(e.message)}`)}
}

const modalSchemas={
  event:{title:"موعد جديد",fields:[["title","العنوان","text"],["type","النوع","select","محاضرة|كويز|First|Second|Mid|Final|مشروع|واجب|شخصي"],["course","المادة","text"],["date","التاريخ","date"],["time","الوقت","time"],["location","المكان","text"],["notes","ملاحظات","textarea"]]},
  course:{title:"مادة جديدة",fields:[["name","اسم المادة","text"],["instructor","المدرس","text"],["hours","الساعات","number"],["first","First","number"],["second","Second / Mid","number"],["projects","مشاريع وأعمال","number"],["final","Final","number"],["total","العلامة المستهدفة","number"]]},
  task:{title:"مهمة جديدة",fields:[["title","المهمة","text"],["category","التصنيف","select","دراسة|عمل|مشروع|شخصي|صحة"],["date","الموعد النهائي","date"],["priority","الأولوية","select","عالية|متوسطة|منخفضة"],["notes","تفاصيل","textarea"]]},
  habit:{title:"عادة جديدة",fields:[["name","اسم العادة","text"],["target","الهدف اليومي","number"],["unit","الوحدة","text"]]},
  expense:{title:"حركة مالية",fields:[["type","النوع","select","مصروف|دخل"],["category","التصنيف","select","طعام|مواصلات|جامعة|جيم|ترفيه|دخل|أخرى"],["amount","المبلغ","number"],["date","التاريخ","date"],["notes","ملاحظات","text"]]},
  progress:{title:"تسجيل التقدم",fields:[["date","التاريخ","date"],["weight","الوزن","number"],["waist","محيط الخصر (سم)","number"],["studyHours","ساعات الدراسة","number"],["sleepHours","ساعات النوم","number"],["note","ملاحظة","text"]]},
  note:{title:"ملاحظة جديدة",fields:[["title","العنوان","text"],["text","الملاحظة","textarea"],["color","التصنيف","select","عام|دراسة|صحة|فكرة"]]}
};
function openModal(type,editId=null){
  const schema=modalSchemas[type],collection=collectionFor(type),item=editId?workspace()[collection].find(x=>x.id===editId):{};
  modalState={type,editId,collection};$("#modalTitle").textContent=editId?`تعديل: ${schema.title}`:schema.title;
  $("#modalFields").innerHTML=schema.fields.map(([name,label,type2,opts])=>{
    const val=item?.[name]??((type2==="date")?today():"");
    if(type2==="textarea")return `<label class="full">${label}<textarea name="${name}">${esc(val)}</textarea></label>`;
    if(type2==="select")return `<label>${label}<select name="${name}">${opts.split("|").map(o=>`<option ${val===o?"selected":""}>${o}</option>`).join("")}</select></label>`;
    return `<label>${label}<input name="${name}" type="${type2}" step="${type2==="number"?"0.1":""}" value="${esc(val)}" ${name==="title"||name==="name"||name==="amount"?"required":""}></label>`;
  }).join("");
  $("#modal").classList.remove("hidden");
}
function collectionFor(type){return({event:"events",course:"courses",task:"tasks",habit:"habits",expense:"expenses",progress:"progress",note:"notes"})[type]}
function closeModal(){$("#modal").classList.add("hidden");modalState=null}
$("#modalClose").onclick=$("#modalCancel").onclick=closeModal;
$("#modalForm").onsubmit=async e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const schema=modalSchemas[modalState.type];
  schema.fields.filter(x=>x[2]==="number").forEach(x=>data[x[0]]=Number(data[x[0]]||0));
  const list=workspace()[modalState.collection];
  if(modalState.editId){const i=list.findIndex(x=>x.id===modalState.editId);list[i]={...list[i],...data}}
  else list.push({id:id(),...data,done:false,createdAt:new Date().toISOString()});
  await saveData();closeModal();renderDashboard(view);toast("تم الحفظ");
};
async function removeItem(collection,itemId){if(!confirm("هل تريد الحذف؟"))return;userData.workspace[collection]=workspace()[collection].filter(x=>x.id!==itemId);await saveData();renderDashboard(view);toast("تم الحذف")}
async function toggleTask(itemId){const x=workspace().tasks.find(x=>x.id===itemId);x.done=!x.done;await saveData();renderDashboard(view)}
async function habitChange(itemId,delta){const h=workspace().habits.find(x=>x.id===itemId);if(h.date!==today()){h.date=today();h.value=0}h.value=Math.max(0,Math.min(Number(h.target),Number(h.value||0)+delta));await saveData();renderDashboard(view)}

function row(item,{time="",title="",details="",collection="",type=""}={}){
  return `<div class="row">${time?`<time>${esc(time)}</time>`:""}<div><b>${esc(title)}</b><small>${esc(details)}</small></div>${collection?`<div class="row-actions"><button class="icon-btn" data-edit="${type}:${item.id}">✎</button><button class="icon-btn red" data-delete="${collection}:${item.id}">×</button></div>`:""}</div>`;
}
function empty(text){return `<div class="empty">${text}</div>`}
function sectionHeader(title,type,label="＋ إضافة"){return `<div class="section-title"><h2>${title}</h2><button class="secondary compact" data-add="${type}">${label}</button></div>`}
function plan(){return userData.plan||{summary:"",targets:{},dailySchedule:[],meals:[],workouts:[],habits:[],studyPlan:[],safetyNote:""}}
function upcoming(){return workspace().events.filter(e=>e.date>=today()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))}
function subscriptionAction(location="home"){
  if(billing.mode==="owner")return `<span class="subscription-state owner">✓ حساب المالك — وصول دائم</span>`;
  if(billing.mode==="active")return `<span class="subscription-state active">✓ اشتراكك فعّال</span>`;
  return `<button class="primary subscription-cta ${location==="settings"?"wide":""}" data-open-subscription>✦ الاشتراك في وازن Pro</button>`;
}

function renderHome(){
  const p=plan(),w=workspace(),events=upcoming(),tasks=w.tasks.filter(x=>!x.done).sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
  const completed=w.tasks.length?w.tasks.filter(x=>x.done).length/w.tasks.length*100:0;
  const spent=w.expenses.filter(x=>x.type==="مصروف"&&x.date===today()).reduce((s,x)=>s+Number(x.amount),0);
  return `<div class="hero"><div><h1>خطتك الشخصية جاهزة ✦</h1><p>${esc(p.summary)}</p></div><div class="home-actions"><span class="badge green">${Math.round(completed)}% إنجاز المهام</span>${subscriptionAction()}</div></div>
  <div class="stats">${[["السعرات",p.targets.calories||"—"],["البروتين",`${p.targets.proteinGrams||"—"} غ`],["أقرب موعد",events[0]?formatDate(events[0].date):"لا يوجد"],["مصروف اليوم",money(spent)]].map(x=>`<article class="card"><span>${x[0]}</span><strong>${x[1]}</strong><small>ملخص اليوم</small></article>`).join("")}</div>
  <div class="grid2"><article class="panel"><h2>الأهم الآن</h2>${tasks.slice(0,5).map(x=>row(x,{title:x.title,details:`${x.category} • ${x.date||"بدون موعد"}`})).join("")||empty("لا توجد مهام مفتوحة")}</article>
  <article class="panel"><h2>المواعيد القادمة</h2>${events.slice(0,5).map(x=>row(x,{time:x.date,title:x.title,details:`${x.type}${x.course?` • ${x.course}`:""}`})).join("")||empty("أضف امتحانًا أو مشروعًا من التقويم")}</article></div>
  <div class="grid2"><article class="panel"><h2>جدول اليوم المقترح</h2>${p.dailySchedule.slice(0,6).map(x=>row(x,{time:x.time,title:x.title,details:x.details})).join("")}</article>
  <article class="panel"><h2>عادات اليوم</h2>${w.habits.slice(0,6).map(h=>`<div class="metric"><div><b>${esc(h.name)}</b><small class="muted"> ${h.value||0}/${h.target} ${esc(h.unit)}</small></div><button class="check ${(h.value||0)>=h.target?"done":""}" data-habit="${h.id}:1">✓</button></div>`).join("")}</article></div>`;
}
function renderToday(){
  const p=plan(),tasks=workspace().tasks.filter(x=>x.date===today()||(!x.date&&!x.done));
  return `<div class="hero"><div><h1>يومي</h1><p>${formatDate(today())} — اجمع جدولك ومهامك في خط زمني واحد.</p></div><button class="primary" data-add="task">＋ مهمة</button></div>
  <div class="grid2"><article class="panel"><h2>الجدول</h2>${p.dailySchedule.map(x=>row(x,{time:x.time,title:x.title,details:x.details})).join("")}</article>
  <article class="panel"><h2>مهام اليوم</h2>${tasks.map(x=>`<div class="row"><button class="check ${x.done?"done":""}" data-task="${x.id}">✓</button><div><b style="${x.done?"text-decoration:line-through":""}">${esc(x.title)}</b><small>${esc(x.category)} • ${esc(x.priority||"متوسطة")}</small></div><div class="row-actions"><button class="icon-btn" data-edit="task:${x.id}">✎</button><button class="icon-btn red" data-delete="tasks:${x.id}">×</button></div></div>`).join("")||empty("لا توجد مهام اليوم")}</article></div>`;
}
function renderCalendar(){
  const y=calendarDate.getFullYear(),m=calendarDate.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),events=workspace().events;
  const names=["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
  let days="";
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d),dayEvents=events.filter(e=>e.date===key);days+=`<div class="calendar-day ${d.getMonth()!==m?"out":""} ${key===today()?"today":""}"><b>${d.getDate()}</b>${dayEvents.slice(0,3).map(e=>`<span class="event-dot ${["كويز","First","Second","Mid","Final"].includes(e.type)?"exam":e.type==="مشروع"?"project":""}">${esc(e.title)}</span>`).join("")}</div>`}
  const title=hasRole("school")?"التقويم المدرسي":hasRole("university")?"التقويم الجامعي":"التقويم والمواعيد";
  const subtitle=isStudying()?"اختبارات، واجبات، مشاريع ومواعيد مهمة.":"دوام، مقابلات، التزامات ومواعيد شخصية.";
  return `<div class="hero"><div><h1>${title}</h1><p>${subtitle}</p></div><button class="primary" data-add="event">＋ موعد</button></div>
  <article class="panel" style="margin-top:20px"><div class="calendar-head"><button class="secondary" data-month="-1">‹</button><h2>${new Intl.DateTimeFormat("ar-JO",{month:"long",year:"numeric"}).format(calendarDate)}</h2><button class="secondary" data-month="1">›</button></div><div class="calendar-grid">${names.map(n=>`<b class="muted">${n}</b>`).join("")}${days}</div></article>
  <article class="panel" style="margin-top:14px">${sectionHeader("كل المواعيد","event")}${events.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(x=>row(x,{time:x.date,title:x.title,details:`${x.type} • ${x.course||""} ${x.time||""}`,collection:"events",type:"event"})).join("")||empty("لا توجد مواعيد")}</article>`;
}
function renderStudy(){
  const w=workspace();
  const school=hasRole("school"),title=school?"المدرسة والمواد":"الجامعة والمواد",subtitle=school?"تابع موادك وواجباتك واختباراتك المدرسية.":"تابع علاماتك ومشاريعك وموادك الجامعية.";
  const studyTasks=w.tasks.filter(x=>["دراسة","مشروع"].includes(x.category));
  return `<div class="hero"><div><h1>${title}</h1><p>${subtitle}</p></div><button class="primary" data-add="course">＋ مادة</button></div>
  <div class="cards">${w.courses.map(c=>{const scored=Number(c.first)+Number(c.second)+Number(c.projects)+Number(c.final),target=Number(c.total||100);return `<article class="card"><span>${esc(c.instructor||"المادة")}</span><h2>${esc(c.name)}</h2><strong>${scored}/${target}</strong><small>${c.hours||0} ساعات • المتبقي للهدف ${Math.max(0,target-scored)}</small><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,scored/target*100)}%"></div></div><div class="toolbar"><button class="icon-btn" data-edit="course:${c.id}">تعديل</button><button class="icon-btn red" data-delete="courses:${c.id}">حذف</button></div></article>`}).join("")||empty("أضف موادك وعلاماتك")}</div>
  <article class="panel" style="margin-top:14px">${sectionHeader("المهام والمشاريع","task")}${studyTasks.map(x=>`<div class="row"><button class="check ${x.done?"done":""}" data-task="${x.id}">✓</button><div><b>${esc(x.title)}</b><small>${esc(x.category)} • ${esc(x.date||"بدون موعد")} • ${esc(x.priority)}</small></div><div class="row-actions"><button class="icon-btn" data-edit="task:${x.id}">✎</button><button class="icon-btn red" data-delete="tasks:${x.id}">×</button></div></div>`).join("")||empty("أضف واجباتك ومشاريعك")}</article>`;
}
function renderWork(){
  const a=userData.answers||{},w=workspace(),employee=hasRole("employee");
  const workTasks=w.tasks.filter(x=>x.category==="عمل");
  const cards=employee
    ?[["المسمى الوظيفي",a.jobTitle||"أضفه من معلوماتك"],["أيام العمل",a.workDays||"غير محددة"],["ساعات الدوام",a.workSchedule||"غير محددة"]]
    :[["الفرصة المطلوبة",a.desiredJob||"حدد المجال المناسب"],["وقت البحث اليومي",a.jobSearchHours?`${a.jobSearchHours} ساعات`:"غير محدد"],["المهارات",a.jobSkills||"أضف مهاراتك"]];
  return `<div class="hero"><div><h1>${employee?"العمل والأهداف":"البحث عن عمل"}</h1><p>${employee?"نظّم دوامك ومهامك المهنية بدون أن تختلط ببقية يومك.":"حوّل البحث عن فرصة إلى خطوات يومية واضحة وقابلة للإنجاز."}</p></div><button class="primary" data-add="task">＋ مهمة عمل</button></div>
  <div class="grid3 work-overview">${cards.map(([label,value])=>`<article class="card"><span>${label}</span><strong>${esc(value)}</strong><small>من معلوماتك الحالية</small></article>`).join("")}</div>
  <div class="grid2"><article class="panel"><h2>${employee?"أهداف العمل":"خطة التطور والبحث"}</h2><p class="work-copy">${esc(employee?a.workGoals||"أضف أهدافك المهنية من صفحة الإعدادات.":a.jobSkills||"أضف المهارات التي تريد تطويرها والوظائف التي تبحث عنها.")}</p></article>
  <article class="panel">${sectionHeader("مهام العمل","task")}${workTasks.map(x=>`<div class="row"><button class="check ${x.done?"done":""}" data-task="${x.id}">✓</button><div><b>${esc(x.title)}</b><small>${esc(x.date||"بدون موعد")} • ${esc(x.priority||"متوسطة")}</small></div><div class="row-actions"><button class="icon-btn" data-edit="task:${x.id}">✎</button><button class="icon-btn red" data-delete="tasks:${x.id}">×</button></div></div>`).join("")||empty("أضف أول مهمة مرتبطة بالعمل")}</article></div>`;
}
function renderNutrition(){
  const p=plan(),goal=userData.answers?.goal||"تنظيم الحياة",checks=workspace().mealChecks;
  const tips={تنشيف:"عجز سعرات معتدل، بروتين مرتفع، وخضار أكثر.",تضخيم:"فائض سعرات تدريجي مع بروتين وكارب كافيين.", "تثبيت الوزن":"سعرات قريبة من الاحتياج مع متابعة الوزن أسبوعيًا.","تنظيم الحياة":"وجبات متوازنة وسهلة الالتزام ضمن الميزانية."};
  return `<div class="hero"><div><h1>نظام ${esc(goal)}</h1><p>${tips[goal]}</p></div><button class="primary" id="regenNutrition">✦ تحديث بالذكاء الاصطناعي</button></div>
  <div class="stats">${[["السعرات",p.targets.calories],["البروتين",`${p.targets.proteinGrams} غ`],["الماء",`${p.targets.waterCups} أكواب`],["الهدف",goal]].map(x=>`<article class="card"><span>${x[0]}</span><strong>${x[1]||"—"}</strong><small>هدف يومي</small></article>`).join("")}</div>
  <div class="cards">${p.meals.map((x,i)=>`<article class="card"><span>${esc(x.time)}</span><h2>${esc(x.name)}</h2><p class="muted">${esc(x.foods)}</p><strong>${x.calories} سعرة</strong><button class="check ${checks[i]?"done":""}" data-meal="${i}">✓</button></article>`).join("")||empty("أعد التحليل لإنشاء الوجبات")}</div>
  <article class="panel" style="margin-top:14px"><h2>قائمة مشتريات مقترحة</h2><p class="muted">بروتين اقتصادي، أرز أو خبز، شوفان، لبن، خضار موسمية، فواكه ومياه. اختر البدائل الأنسب لميزانيتك وحساسيتك.</p></article>`;
}
function renderWorkouts(){
  const checks=workspace().workoutChecks;
  return `<div class="hero"><div><h1>التمارين</h1><p>اضغط على أي يوم لعرض الأجهزة والجولات والتكرارات.</p></div><span class="badge">4 أيام تدريب</span></div>
  <div class="grid2 workout-grid">${DEFAULT_WORKOUT_SPLIT.map((x,i)=>`<article class="panel workout-card ${expandedWorkout===i?"expanded":""}" data-workout-open="${i}">
    <div class="section-title"><div><span class="badge">${esc(x.day)}</span><h2>${esc(x.focus)}</h2><small class="muted">${x.exercises.length} تمارين</small></div><div class="workout-summary"><strong>60 دقيقة</strong><span>${expandedWorkout===i?"إخفاء التفاصيل ▲":"عرض التمارين ▼"}</span></div></div>
    ${expandedWorkout===i?`<div class="exercise-list">${x.exercises.map((ex,n)=>`<div class="exercise-item"><div class="exercise-number">${n+1}</div><div><b>${esc(ex.name)}</b><small>الجهاز: ${esc(ex.machine)} • العضلة: ${esc(ex.muscle)}</small><small>${esc(ex.sets)} جولات × ${esc(ex.reps)} تكرار • راحة ${esc(ex.restSeconds)} ثانية</small><small>${esc(ex.notes)}</small></div></div>`).join("")}</div>`:""}
    <button class="check ${checks[i]?"done":""}" data-workout="${i}" title="تحديد اليوم كمكتمل">✓</button>
  </article>`).join("")}</div>`;
}
function renderHabits(){
  const habits=workspace().habits;
  return `<div class="hero"><div><h1>العادات اليومية</h1><p>خطوات صغيرة، نتائج مستمرة.</p></div><button class="primary" data-add="habit">＋ عادة</button></div><div class="cards">${habits.map(h=>{const value=h.date===today()?Number(h.value||0):0,pct=Math.min(100,value/Number(h.target||1)*100);return `<article class="card"><span>${esc(h.unit)}</span><h2>${esc(h.name)}</h2><strong>${value}/${h.target}</strong><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="toolbar"><button class="secondary" data-habit="${h.id}:-1">−</button><button class="primary" data-habit="${h.id}:1">＋</button><button class="icon-btn" data-edit="habit:${h.id}">✎</button><button class="icon-btn red" data-delete="habits:${h.id}">×</button></div></article>`}).join("")}</div>`;
}
function renderExpenses(){
  const list=workspace().expenses,totalIn=list.filter(x=>x.type==="دخل").reduce((s,x)=>s+Number(x.amount),0),totalOut=list.filter(x=>x.type==="مصروف").reduce((s,x)=>s+Number(x.amount),0);
  const byCat=Object.entries(list.filter(x=>x.type==="مصروف").reduce((a,x)=>(a[x.category]=(a[x.category]||0)+Number(x.amount),a),{})).sort((a,b)=>b[1]-a[1]);
  return `<div class="hero"><div><h1>المصاريف والميزانية</h1><p>اعرف أين يذهب مصروفك.</p></div><button class="primary" data-add="expense">＋ حركة مالية</button></div>
  <div class="stats"><article class="card"><span>الدخل</span><strong class="money-positive">${money(totalIn)}</strong></article><article class="card"><span>المصروف</span><strong class="money-negative">${money(totalOut)}</strong></article><article class="card"><span>المتبقي</span><strong>${money(totalIn-totalOut)}</strong></article><article class="card"><span>أعلى تصنيف</span><strong>${esc(byCat[0]?.[0]||"—")}</strong></article></div>
  <article class="panel" style="margin-top:14px">${list.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>row(x,{time:x.date,title:`${x.type==="دخل"?"+":"-"} ${money(x.amount)}`,details:`${x.category} • ${x.notes||""}`,collection:"expenses",type:"expense"})).join("")||empty("سجل أول مصروف أو دخل")}</article>`;
}
function renderProgress(){
  const list=workspace().progress.sort((a,b)=>a.date.localeCompare(b.date)),latest=list.at(-1),first=list[0];
  const change=latest&&first?Number(latest.weight)-Number(first.weight):0;
  return `<div class="hero"><div><h1>تقدمي</h1><p>الوزن والقياسات والنوم والدراسة.</p></div><button class="primary" data-add="progress">＋ تسجيل جديد</button></div>
  <div class="stats"><article class="card"><span>الوزن الحالي</span><strong>${latest?.weight||userData.answers?.weight||"—"} كغم</strong></article><article class="card"><span>التغير</span><strong class="${change<=0?"money-positive":"money-negative"}">${change>0?"+":""}${change.toFixed(1)} كغم</strong></article><article class="card"><span>الخصر</span><strong>${latest?.waist||"—"} سم</strong></article><article class="card"><span>ساعات الدراسة</span><strong>${latest?.studyHours||"—"}</strong></article></div>
  <article class="panel" style="margin-top:14px">${list.slice().reverse().map(x=>row(x,{time:x.date,title:`${x.weight} كغم • خصر ${x.waist||"—"} سم`,details:`دراسة ${x.studyHours||0}س • نوم ${x.sleepHours||0}س • ${x.note||""}`,collection:"progress",type:"progress"})).join("")||empty("سجل وزنك وتقدمك أسبوعيًا")}</article>`;
}
function renderNotes(){
  return `<div class="hero"><div><h1>الملاحظات</h1><p>أفكارك وقوائمك في مكان واحد.</p></div><button class="primary" data-add="note">＋ ملاحظة</button></div><div class="grid3">${workspace().notes.map(n=>`<article class="card note-card"><span>${esc(n.color)}</span><h2>${esc(n.title)}</h2><p>${esc(n.text)}</p><div class="toolbar"><button class="icon-btn" data-edit="note:${n.id}">تعديل</button><button class="icon-btn red" data-delete="notes:${n.id}">حذف</button></div></article>`).join("")||empty("أضف أول ملاحظة")}</div>`;
}
function renderAssistant(){
  return `<div class="hero"><div><h1>المساعد الذكي</h1><p>حدّث خطتك كاملة حسب بياناتك الجديدة.</p></div></div><article class="panel assistant-box" style="margin-top:20px"><h2>مراجعة الخطة</h2><p class="muted">عدّل بياناتك ثم اطلب من الذكاء الاصطناعي بناء جدول ووجبات وتمارين جديدة.</p><div class="assistant-answer">${esc(plan().summary)}</div><button class="primary" id="assistantRegenerate">✦ إعادة تحليل حياتي</button></article>`;
}
function renderSettings(){
  const a=userData.answers||{};
  const roleLabels=(a.roles||[]).map(r=>roleOptions.find(x=>x[0]===r)?.[1]).filter(Boolean).join(" و ");
  const profile=[["▦","وضعك الحالي",roleLabels||"—"],["◎","هدفك الحالي",a.goal],["◉","العمر",a.age?`${a.age} سنة`:"—"],["↕","الطول",a.height?`${a.height} سم`:"—"],["◆","الوزن الحالي",a.weight?`${a.weight} كغم`:"—"],["⌖","الوزن المستهدف",a.targetWeight?`${a.targetWeight} كغم`:"—"],["◷","النوم",a.sleep&&a.wake?`من ${a.sleep} إلى ${a.wake}`:"—"],["↗","مستوى النشاط",a.activityLevel||"—"],["♨","النظام الغذائي",a.dietType||"—"]];
  return `<div class="hero"><div><h1>الإعدادات والبيانات</h1><p>راجع معلوماتك وحدّث خطتك في أي وقت.</p></div></div><div class="settings-layout"><article class="panel profile-panel"><div class="section-title"><div><span class="badge">ملفي الشخصي</span><h2>معلوماتي الأساسية</h2></div><button class="primary compact" id="restartOnboarding">تعديل المعلومات</button></div><div class="profile-grid">${profile.map(([icon,label,value])=>`<div class="profile-item"><i>${icon}</i><div><span>${label}</span><b>${esc(value)}</b></div></div>`).join("")}</div></article><article class="panel account-panel"><span class="badge green">حسابك بأمان</span><h2>أنت المتحكم</h2><p class="muted">معلوماتك مخصصة لك ولا تظهر للمستخدمين الآخرين. يمكنك تحديث بياناتك وخطتك متى أردت.</p><div class="account-points"><span>✓ خطتك مرتبطة بحسابك</span><span>✓ يمكنك تعديل معلوماتك في أي وقت</span><span>✓ لا نستخدم كلمة مرورك في إنشاء الخطة</span></div><div class="account-subscription">${subscriptionAction("settings")}</div><button class="danger" id="logoutSettings">تسجيل الخروج</button></article></div>`;
}

const renderers={home:renderHome,today:renderToday,calendar:renderCalendar,study:renderStudy,work:renderWork,nutrition:renderNutrition,workouts:renderWorkouts,habits:renderHabits,expenses:renderExpenses,progress:renderProgress,notes:renderNotes,assistant:renderAssistant,settings:renderSettings};
function renderDashboard(next="home"){
  const studying=isStudying(),workContext=hasWorkContext(),training=isTraining();
  const studyButton=$('[data-view="study"]'),workButton=$('[data-view="work"]'),workoutButton=$('[data-view="workouts"]');
  studyButton.classList.toggle("hidden",!studying);
  workButton.classList.toggle("hidden",!workContext);
  workoutButton.classList.toggle("hidden",!training);
  if(studyButton)studyButton.textContent=hasRole("school")?"▣ المدرسة":hasRole("university")?"▣ الجامعة":"▣ التعلّم";
  if(workButton)workButton.textContent=hasRole("employee")?"▤ العمل":"▤ فرص العمل";
  if((next==="study"&&!studying)||(next==="work"&&!workContext)||(next==="workouts"&&!training))next="home";
  view=next;workspace();
  const n=currentUser.displayName||userData.name||"صديقي";
  $("#userGreeting").textContent=`مرحبًا ${n}`;
  $("#headerSubtitle").textContent=`${formatDate(today())} • ${userData.answers?.goal||"تنظيم حياتك"}`;
  const readOnly=billing.mode==="read_only";
  const badge=$("#billingBadge");
  const badgeInfo={
    owner:["المالك • وصول دائم","owner"],
    active:["اشتراك فعّال","active"],
    trial:[`تجربة مجانية • ${billing.daysRemaining||0} يوم`,"trial"],
    read_only:[`مشاهدة فقط • ${billing.daysRemaining||0} يوم`,"warning"]
  }[billing.mode]||["",""];
  badge.textContent=badgeInfo[0];
  badge.className=`billing-badge ${badgeInfo[1]}`;
  $("#dashboard").classList.toggle("readonly-mode",readOnly);
  $("#quickAdd").classList.toggle("hidden",readOnly);
  $("#accessBanner").classList.toggle("hidden",!["trial","read_only"].includes(billing.mode));
  if(billing.mode==="trial")$("#accessBanner").innerHTML=`<div><b>تجربتك المجانية فعّالة</b><span>بقي ${billing.daysRemaining||0} يومًا لاستخدام جميع الميزات. يمكنك الاشتراك الآن أو متابعة التجربة.</span></div><button class="secondary compact" id="bannerSubscribe">عرض الاشتراكات</button>`;
  if(readOnly)$("#accessBanner").innerHTML=`<div><b>فترة مشاهدة فقط</b><span>بقي ${billing.daysRemaining||0} أيام قبل قفل الحساب. اشترك لاستعادة التعديل والذكاء الاصطناعي.</span></div><button class="primary compact" id="bannerSubscribe">عرض الاشتراكات</button>`;
  $$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("#view").innerHTML=(renderers[view]||renderHome)();
  $("#dashboard aside").classList.remove("open");
  bindViewActions();
}
function bindViewActions(){
  if(billing.mode==="read_only"){
    $$("[data-add],[data-edit],[data-delete],[data-task],[data-habit],[data-meal],[data-workout],#restartOnboarding,#assistantRegenerate,#regenNutrition").forEach(b=>{b.disabled=true;b.title="التعديل يحتاج اشتراكًا فعالًا"});
  }
  $$("[data-add]").forEach(b=>b.onclick=()=>canEdit()&&openModal(b.dataset.add));
  $$("[data-edit]").forEach(b=>b.onclick=()=>{const [type,itemId]=b.dataset.edit.split(":");openModal(type,itemId)});
  $$("[data-delete]").forEach(b=>b.onclick=()=>{const [collection,itemId]=b.dataset.delete.split(":");removeItem(collection,itemId)});
  $$("[data-task]").forEach(b=>b.onclick=()=>toggleTask(b.dataset.task));
  $$("[data-habit]").forEach(b=>b.onclick=()=>{const [itemId,delta]=b.dataset.habit.split(":");habitChange(itemId,Number(delta))});
  $$("[data-month]").forEach(b=>b.onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+Number(b.dataset.month));renderDashboard("calendar")});
  $$("[data-meal]").forEach(b=>b.onclick=async()=>{const k=b.dataset.meal;workspace().mealChecks[k]=!workspace().mealChecks[k];await saveData();renderDashboard("nutrition")});
  $$("[data-workout]").forEach(b=>b.onclick=async()=>{const k=b.dataset.workout;workspace().workoutChecks[k]=!workspace().workoutChecks[k];await saveData();renderDashboard("workouts")});
  $$("[data-workout-open]").forEach(card=>card.onclick=e=>{if(e.target.closest("[data-workout]"))return;const i=Number(card.dataset.workoutOpen);expandedWorkout=expandedWorkout===i?null:i;renderDashboard("workouts")});
  if($("#restartOnboarding"))$("#restartOnboarding").onclick=()=>{if(!canEdit())return;answers={...userData.answers};step=0;show("#onboarding");renderStep()};
  if($("#assistantRegenerate"))$("#assistantRegenerate").onclick=generatePlan;
  if($("#regenNutrition"))$("#regenNutrition").onclick=generatePlan;
  if($("#logoutSettings"))$("#logoutSettings").onclick=()=>signOut(auth);
  $$("[data-open-subscription]").forEach(button=>button.onclick=()=>showSubscription("اختر الاشتراك الشهري أو السنوي لتفعيل وازن Pro."));
  if($("#bannerSubscribe"))$("#bannerSubscribe").onclick=()=>showSubscription(billing.mode==="trial"?"يمكنك الاشتراك الآن والاستمرار دون انقطاع بعد انتهاء التجربة.":"أنت الآن في فترة المشاهدة فقط. اشترك لتفعيل التعديل وجميع الميزات فورًا.");
}
$$("[data-view]").forEach(b=>b.onclick=()=>renderDashboard(b.dataset.view));
$("#quickAdd").onclick=()=>canEdit()&&openModal("task");
$("#menu").onclick=()=>$("#dashboard aside").classList.toggle("open");
$("#logout1").onclick=$("#logout2").onclick=()=>signOut(auth);
$$("[data-subscribe]").forEach(button=>button.onclick=()=>window.location.href=checkoutUrl(button.dataset.subscribe));
$("#checkSubscription").onclick=async()=>{try{$("#checkSubscription").disabled=true;await loadBilling();if(billing.mode==="locked"||billing.mode==="read_only")return showSubscription();const snap=await getDoc(doc(db,"users",currentUser.uid));userData=snap.exists()?snap.data():{};show("#dashboard");renderDashboard("home")}catch(e){toast(friendlyError(e.message))}finally{$("#checkSubscription").disabled=false}};
$("#subscriptionLogout").onclick=()=>signOut(auth);
