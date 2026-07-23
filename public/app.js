import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const config={apiKey:"AIzaSyD0aqTFxCsXOROKXaLZE9IV0zGmWCqsKQ8",authDomain:"hayati-app-35028.firebaseapp.com",projectId:"hayati-app-35028",storageBucket:"hayati-app-35028.firebasestorage.app",messagingSenderId:"216794693163",appId:"1:216794693163:web:e864c50ad01fde5f1ab46e"};
const AI_ENDPOINT="https://hayati-ai.nezarcaht.workers.dev";
// ارفع هذا الرقم فقط عندما يحتاج التحديث إلى إعادة تعبئة بيانات جميع المستخدمين.
const PROFILE_VERSION=3;
const fb=initializeApp(config),auth=getAuth(fb),db=getFirestore(fb);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const screens=["#loader","#auth","#onboarding","#analyzing","#dashboard"];
const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today=()=>dateKey();
const id=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let mode="login",step=0,currentUser=null,userData={},answers={},view="home",calendarDate=new Date(),modalState=null;

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

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user)return show("#auth");
  try{
    const snap=await getDoc(doc(db,"users",user.uid));
    userData=snap.exists()?snap.data():{};
    if(snap.exists()&&Number(userData.profileVersion||0)<PROFILE_VERSION){
      await setDoc(doc(db,"users",user.uid),{onboardingComplete:false,profileVersion:PROFILE_VERSION,answers:{}},{merge:true});
      await signOut(auth);
      show("#auth");
      $("#authError").textContent="تم تحديث التطبيق. سجّل الدخول مجددًا ثم عبّئ بياناتك الجديدة.";
      return;
    }
    workspace();
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
    if(mode==="signup"){
      const c=await createUserWithEmailAndPassword(auth,$("#email").value,$("#password").value);
      await updateProfile(c.user,{displayName:$("#name").value});
      await setDoc(doc(db,"users",c.user.uid),{name:$("#name").value,email:c.user.email,onboardingComplete:false,profileVersion:PROFILE_VERSION,workspace:emptyWorkspace()});
    }else await signInWithEmailAndPassword(auth,$("#email").value,$("#password").value);
  }catch(e){$("#authError").textContent=`تعذر تسجيل الدخول: ${e.code||e.message}`}
};
$("#googleLogin").onclick=async()=>{try{$("#authError").textContent="";await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){$("#authError").textContent=`تعذر تسجيل Google: ${e.code||e.message}`}};
$("#resetPassword").onclick=async()=>{try{if(!$("#email").value)return $("#authError").textContent="اكتب بريدك أولًا";await sendPasswordResetEmail(auth,$("#email").value);toast("تم إرسال رابط الاستعادة")}catch(e){$("#authError").textContent=e.code||e.message}};

const steps=[
  {title:"بياناتك الأساسية",desc:"لنحسب لك أهدافًا مناسبة.",html:()=>`<div class="fields"><label>العمر<input id="age" type="number" value="${answers.age||""}"></label><label>الطول (سم)<input id="height" type="number" value="${answers.height||""}"></label><label>الوزن (كغم)<input id="weight" type="number" step=".1" value="${answers.weight||""}"></label><label>الجنس<select id="gender"><option value="male">ذكر</option><option value="female">أنثى</option></select></label></div>`},
  {title:"ما هدفك؟",desc:"نخصص التغذية والتمارين حسب هدفك.",html:()=>`<div class="option-grid">${["تنشيف","تضخيم","تثبيت الوزن","تنظيم الحياة"].map(x=>`<button class="option ${answers.goal===x?"selected":""}" data-goal="${x}">${x}</button>`).join("")}</div>`},
  {title:"النوم والاستيقاظ",desc:"سنرتب يومك حولهما.",html:()=>`<div class="fields"><label>وقت النوم<input id="sleep" type="time" value="${answers.sleep||"00:00"}"></label><label>وقت الاستيقاظ<input id="wake" type="time" value="${answers.wake||"07:30"}"></label></div>`},
  {title:"الدوام أو الجامعة",desc:"اكتب جدولك الأسبوعي.",html:()=>`<label>المواعيد<textarea id="schedule" rows="6" placeholder="الأحد من 8:30 إلى 3:20...">${answers.schedule||""}</textarea></label>`},
  {title:"الأكل والتمرين",desc:"حتى تكون الخطة واقعية.",html:()=>`<div class="fields"><label>أكلات تحبها<textarea id="liked">${answers.liked||""}</textarea></label><label>أكلات لا تحبها أو حساسية<textarea id="disliked">${answers.disliked||""}</textarea></label><label>أيام التمرين<input id="trainingDays" type="number" min="0" max="7" value="${answers.trainingDays??3}"></label><label>وقت التمرين<input id="trainingTime" type="time" value="${answers.trainingTime||"17:00"}"></label></div>`},
  {title:"الدراسة والعادات",desc:"ما الذي تريد إنجازه؟",html:()=>`<div class="fields"><label>المهام الأساسية<textarea id="tasks">${answers.tasks||""}</textarea></label><label>العادات اليومية<textarea id="habits">${answers.habits||""}</textarea></label></div>`},
  {title:"الميزانية والملاحظات",desc:"آخر خطوة.",html:()=>`<div class="fields"><label>الدخل اليومي<input id="income" type="number" step=".1" value="${answers.income||0}"></label><label>المصروف اليومي<input id="expenses" type="number" step=".1" value="${answers.expenses||0}"></label></div><label>ملاحظات<textarea id="notes">${answers.notes||""}</textarea></label><label style="display:flex;grid-template-columns:auto 1fr;gap:10px;margin-top:18px;line-height:1.7"><input id="aiConsent" type="checkbox" style="width:18px" ${answers.aiConsent?"checked":""}><span>أوافق على إرسال إجاباتي إلى Cloudflare وGemini لإنشاء الخطة. لن تُرسل كلمة المرور.</span></label>`}
];
function renderStep(){
  $("#stepLabel").textContent=`الخطوة ${step+1} من ${steps.length}`;
  $("#progressBar").style.width=`${(step+1)/steps.length*100}%`;
  $("#questionBody").innerHTML=`<h1>${steps[step].title}</h1><p>${steps[step].desc}</p>${steps[step].html()}`;
  $("#prevStep").style.visibility=step?"visible":"hidden";
  $("#nextStep").textContent=step===steps.length-1?"✦ إنشاء خطتي":"التالي";
  if($("#gender")&&answers.gender)$("#gender").value=answers.gender;
}
function collect(){
  ["age","height","weight","gender","sleep","wake","schedule","liked","disliked","trainingDays","trainingTime","tasks","habits","income","expenses","notes"].forEach(k=>{const el=$("#"+k);if(el)answers[k]=el.type==="number"?Number(el.value):el.value});
  if($("#aiConsent"))answers.aiConsent=$("#aiConsent").checked;
}
document.addEventListener("click",e=>{if(e.target.dataset.goal){answers.goal=e.target.dataset.goal;renderStep()}});
$("#nextStep").onclick=async()=>{collect();if(step<steps.length-1){step++;renderStep()}else{if(!answers.aiConsent)return alert("يجب الموافقة على إرسال البيانات لإنشاء الخطة.");await generatePlan()}};
$("#prevStep").onclick=()=>{collect();step--;renderStep()};
async function generatePlan(){
  show("#analyzing");
  try{
    const token=await currentUser.getIdToken(true);
    const response=await fetch(AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({answers})});
    const result=await response.json();
    if(!response.ok||!result.plan)throw new Error(result.error||"تعذر إنشاء الخطة");
    await setDoc(doc(db,"users",currentUser.uid),{answers,plan:result.plan,onboardingComplete:true,profileVersion:PROFILE_VERSION},{merge:true});
    userData={...userData,answers,plan:result.plan,onboardingComplete:true,profileVersion:PROFILE_VERSION};show("#dashboard");renderDashboard("home");
  }catch(e){console.error(e);show(userData.plan?"#dashboard":"#onboarding");if(userData.plan)renderDashboard(view);alert(`تعذر إنشاء الخطة: ${e.message}`)}
}

const modalSchemas={
  event:{title:"موعد جديد",fields:[["title","العنوان","text"],["type","النوع","select","محاضرة|كويز|First|Second|Mid|Final|مشروع|واجب|شخصي"],["course","المادة","text"],["date","التاريخ","date"],["time","الوقت","time"],["location","المكان","text"],["notes","ملاحظات","textarea"]]},
  course:{title:"مادة جديدة",fields:[["name","اسم المادة","text"],["instructor","المدرس","text"],["hours","الساعات","number"],["first","First","number"],["second","Second / Mid","number"],["projects","مشاريع وأعمال","number"],["final","Final","number"],["total","العلامة المستهدفة","number"]]},
  task:{title:"مهمة جديدة",fields:[["title","المهمة","text"],["category","التصنيف","select","دراسة|مشروع|شخصي|صحة"],["date","الموعد النهائي","date"],["priority","الأولوية","select","عالية|متوسطة|منخفضة"],["notes","تفاصيل","textarea"]]},
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

function renderHome(){
  const p=plan(),w=workspace(),events=upcoming(),tasks=w.tasks.filter(x=>!x.done).sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
  const completed=w.tasks.length?w.tasks.filter(x=>x.done).length/w.tasks.length*100:0;
  const spent=w.expenses.filter(x=>x.type==="مصروف"&&x.date===today()).reduce((s,x)=>s+Number(x.amount),0);
  return `<div class="hero"><div><h1>خطتك الشخصية جاهزة ✦</h1><p>${esc(p.summary)}</p></div><span class="badge green">${Math.round(completed)}% إنجاز المهام</span></div>
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
  return `<div class="hero"><div><h1>التقويم الجامعي</h1><p>كويزات، امتحانات، مشاريع ومحاضرات.</p></div><button class="primary" data-add="event">＋ موعد</button></div>
  <article class="panel" style="margin-top:20px"><div class="calendar-head"><button class="secondary" data-month="-1">‹</button><h2>${new Intl.DateTimeFormat("ar-JO",{month:"long",year:"numeric"}).format(calendarDate)}</h2><button class="secondary" data-month="1">›</button></div><div class="calendar-grid">${names.map(n=>`<b class="muted">${n}</b>`).join("")}${days}</div></article>
  <article class="panel" style="margin-top:14px">${sectionHeader("كل المواعيد","event")}${events.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(x=>row(x,{time:x.date,title:x.title,details:`${x.type} • ${x.course||""} ${x.time||""}`,collection:"events",type:"event"})).join("")||empty("لا توجد مواعيد")}</article>`;
}
function renderStudy(){
  const w=workspace();
  return `<div class="hero"><div><h1>الدراسة والمواد</h1><p>تابع علاماتك ومشاريعك واعرف تقدمك.</p></div><button class="primary" data-add="course">＋ مادة</button></div>
  <div class="cards">${w.courses.map(c=>{const scored=Number(c.first)+Number(c.second)+Number(c.projects)+Number(c.final),target=Number(c.total||100);return `<article class="card"><span>${esc(c.instructor||"المادة")}</span><h2>${esc(c.name)}</h2><strong>${scored}/${target}</strong><small>${c.hours||0} ساعات • المتبقي للهدف ${Math.max(0,target-scored)}</small><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,scored/target*100)}%"></div></div><div class="toolbar"><button class="icon-btn" data-edit="course:${c.id}">تعديل</button><button class="icon-btn red" data-delete="courses:${c.id}">حذف</button></div></article>`}).join("")||empty("أضف موادك وعلاماتك")}</div>
  <article class="panel" style="margin-top:14px">${sectionHeader("المهام والمشاريع","task")}${w.tasks.map(x=>`<div class="row"><button class="check ${x.done?"done":""}" data-task="${x.id}">✓</button><div><b>${esc(x.title)}</b><small>${esc(x.category)} • ${esc(x.date||"بدون موعد")} • ${esc(x.priority)}</small></div><div class="row-actions"><button class="icon-btn" data-edit="task:${x.id}">✎</button><button class="icon-btn red" data-delete="tasks:${x.id}">×</button></div></div>`).join("")||empty("أضف واجباتك ومشاريعك")}</article>`;
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
  return `<div class="hero"><div><h1>التمارين</h1><p>برنامجك الأسبوعي حسب هدفك وعدد أيامك.</p></div><span class="badge">${userData.answers?.trainingDays||0} أيام أسبوعيًا</span></div>
  <div class="cards">${plan().workouts.map((x,i)=>`<article class="card"><span>${esc(x.day)}</span><h2>${esc(x.focus)}</h2><strong>${x.durationMinutes} دقيقة</strong><p class="muted">${esc(x.notes)}</p><button class="check ${checks[i]?"done":""}" data-workout="${i}">✓</button></article>`).join("")||empty("لا يوجد برنامج تمارين")}</div>`;
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
  return `<div class="hero"><div><h1>الإعدادات والبيانات</h1><p>تحكم في حسابك وخطتك.</p></div></div><div class="grid2"><article class="panel"><h2>ملفي</h2>${[["الهدف",a.goal],["العمر",a.age],["الطول",`${a.height} سم`],["الوزن",`${a.weight} كغم`],["النوم",`${a.sleep} — ${a.wake}`]].map(x=>`<div class="metric"><span>${x[0]}</span><b>${esc(x[1]||"—")}</b></div>`).join("")}<button class="primary" id="restartOnboarding" style="margin-top:16px">تعديل الإجابات</button></article><article class="panel"><h2>الخصوصية</h2><p class="muted">تُحفظ بياناتك في حسابك على Firebase. تُرسل إجابات الخطة فقط إلى Cloudflare وGemini بعد موافقتك.</p><button class="danger" id="logoutSettings">تسجيل الخروج</button></article></div>`;
}

const renderers={home:renderHome,today:renderToday,calendar:renderCalendar,study:renderStudy,nutrition:renderNutrition,workouts:renderWorkouts,habits:renderHabits,expenses:renderExpenses,progress:renderProgress,notes:renderNotes,assistant:renderAssistant,settings:renderSettings};
function renderDashboard(next="home"){
  view=next;workspace();
  const n=currentUser.displayName||userData.name||"صديقي";
  $("#userGreeting").textContent=`مرحبًا ${n}`;
  $("#headerSubtitle").textContent=`${formatDate(today())} • ${userData.answers?.goal||"تنظيم حياتك"}`;
  $$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("#view").innerHTML=(renderers[view]||renderHome)();
  $("#dashboard aside").classList.remove("open");
  bindViewActions();
}
function bindViewActions(){
  $$("[data-add]").forEach(b=>b.onclick=()=>openModal(b.dataset.add));
  $$("[data-edit]").forEach(b=>b.onclick=()=>{const [type,itemId]=b.dataset.edit.split(":");openModal(type,itemId)});
  $$("[data-delete]").forEach(b=>b.onclick=()=>{const [collection,itemId]=b.dataset.delete.split(":");removeItem(collection,itemId)});
  $$("[data-task]").forEach(b=>b.onclick=()=>toggleTask(b.dataset.task));
  $$("[data-habit]").forEach(b=>b.onclick=()=>{const [itemId,delta]=b.dataset.habit.split(":");habitChange(itemId,Number(delta))});
  $$("[data-month]").forEach(b=>b.onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+Number(b.dataset.month));renderDashboard("calendar")});
  $$("[data-meal]").forEach(b=>b.onclick=async()=>{const k=b.dataset.meal;workspace().mealChecks[k]=!workspace().mealChecks[k];await saveData();renderDashboard("nutrition")});
  $$("[data-workout]").forEach(b=>b.onclick=async()=>{const k=b.dataset.workout;workspace().workoutChecks[k]=!workspace().workoutChecks[k];await saveData();renderDashboard("workouts")});
  if($("#restartOnboarding"))$("#restartOnboarding").onclick=()=>{answers={...userData.answers};step=0;show("#onboarding");renderStep()};
  if($("#assistantRegenerate"))$("#assistantRegenerate").onclick=generatePlan;
  if($("#regenNutrition"))$("#regenNutrition").onclick=generatePlan;
  if($("#logoutSettings"))$("#logoutSettings").onclick=()=>signOut(auth);
}
$$("[data-view]").forEach(b=>b.onclick=()=>renderDashboard(b.dataset.view));
$("#quickAdd").onclick=()=>openModal("task");
$("#menu").onclick=()=>$("#dashboard aside").classList.toggle("open");
$("#logout1").onclick=$("#logout2").onclick=()=>signOut(auth);
