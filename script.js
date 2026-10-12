(() => {
  'use strict';
  const STORAGE_KEY = 'mizanati_transactions_v1';
  const BUDGET_KEY = 'mizanati_budget_v1';
  const categories = {
    'طعام':{icon:'🍽️',color:'#67f5b0'},'فواتير':{icon:'🧾',color:'#72e6d3'},
    'مواصلات':{icon:'🚗',color:'#83b7ff'},'تسوق':{icon:'🛍️',color:'#c4a1ff'},
    'ترفيه':{icon:'🎮',color:'#ffcf70'},'صحة':{icon:'💊',color:'#ff858c'},
    'تعليم':{icon:'📚',color:'#ffab76'},'راتب':{icon:'💰',color:'#7be0ff'},
    'أخرى':{icon:'📌',color:'#b0c0ba'}
  };
  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(n) + ' ج.م';
  const dateString = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = new Date();
  let transactions = [], budget = 10000, toastTimer;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) transactions = saved.filter(t => t && typeof t.id === 'string' && Number.isFinite(Number(t.amount)) && Number(t.amount)>0 && ['income','expense'].includes(t.type));
    const savedBudgetRaw = localStorage.getItem(BUDGET_KEY);
    if (savedBudgetRaw !== null && savedBudgetRaw.trim() !== '') {
      const savedBudget = Number(savedBudgetRaw);
      if (Number.isFinite(savedBudget) && savedBudget >= 0) budget = savedBudget;
    }
  } catch (error) { console.warn('تعذر قراءة البيانات المحفوظة', error); }

  $('monthLabel').textContent = new Intl.DateTimeFormat('ar-EG',{month:'long',year:'numeric'}).format(today);
  $('year').textContent = today.getFullYear();
  $('date').value = dateString(today);
  $('budgetInput').value = budget;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      localStorage.setItem(BUDGET_KEY, String(budget));
    } catch (error) { notify('تعذر حفظ البيانات في المتصفح.'); }
  }
  function notify(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function inCurrentMonth(t) {
    const d = new Date(t.date + 'T12:00:00');
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }
  function sum(type, list=transactions) {
    return list.filter(t => t.type===type).reduce((s,t) => s+Number(t.amount),0);
  }
  function render() {
    const income=sum('income'), expense=sum('expense'), monthItems=transactions.filter(inCurrentMonth);
    const mIncome=sum('income',monthItems), mExpense=sum('expense',monthItems);
    $('balance').innerHTML = `${money(income-expense).replace(' ج.م','')} <span>ج.م</span>`;
    $('heroIncome').textContent=money(income); $('heroExpense').textContent=money(expense);
    $('monthIncome').textContent=money(mIncome); $('monthExpense').textContent=money(mExpense);
    const remaining=budget-mExpense;
    $('remaining').textContent=money(remaining);
    $('remaining').className='number '+(remaining<0?'negative':'positive');
    $('remainingNote').textContent=budget===0?'أدخل ميزانية لمتابعة الإنفاق':remaining<0?'تجاوزت الميزانية المحددة':'المتبقي ضمن ميزانيتك';
    const pct=budget>0?mExpense/budget*100:(mExpense>0?100:0);
    $('budgetPercent').textContent=Math.round(pct)+'%';
    $('budgetFill').style.width=Math.min(pct,100)+'%';
    $('budgetFill').classList.toggle('over',pct>100);
    $('spentLabel').textContent=money(mExpense)+' مصروف'; $('budgetLabel').textContent='من '+money(budget);
    renderChart(monthItems); renderTransactions();
  }
  function renderChart(monthItems) {
    const expenses=monthItems.filter(t=>t.type==='expense'), total=sum('expense',monthItems), totals={};
    expenses.forEach(t=>totals[t.category]=(totals[t.category]||0)+Number(t.amount));
    $('chartTotal').textContent=new Intl.NumberFormat('ar-EG',{maximumFractionDigits:0}).format(total);
    let cursor=0; const stops=[];
    Object.entries(totals).sort((a,b)=>b[1]-a[1]).forEach(([cat,amount])=>{
      const start=total?cursor/total*100:0; cursor+=amount;
      const end=total?cursor/total*100:0;
      stops.push(`${(categories[cat]||categories['أخرى']).color} ${start}% ${end}%`);
    });
    if(!stops.length) stops.push('rgba(255,255,255,.08) 0% 100%');
    $('donut').style.background=`conic-gradient(${stops.join(',')})`;
    const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
    $('legend').innerHTML=sorted.length?sorted.slice(0,6).map(([cat,amount])=>{
      const c=categories[cat]||categories['أخرى'];
      return `<div class="legend-row"><span class="legend-name"><i class="dot" style="background:${c.color}"></i>${escapeHTML(cat)}</span><strong>${Math.round(amount/total*100)}%</strong></div>`;
    }).join(''):'<div class="empty">أضف مصروفًا لعرض التوزيع</div>';
  }
  function renderTransactions() {
    const type=$('filterType').value, category=$('filterCategory').value;
    const list=[...transactions].filter(t=>(type==='all'||t.type===type)&&(category==='all'||t.category===category)).sort((a,b)=>b.date.localeCompare(a.date)||Number(b.createdAt)-Number(a.createdAt));
    $('transactionList').innerHTML=list.length?list.map(t=>{
      const c=categories[t.category]||categories['أخرى'];
      const date=new Date(t.date+'T12:00:00').toLocaleDateString('ar-EG',{day:'numeric',month:'short',year:'numeric'});
      return `<article class="transaction"><div class="tx-icon">${c.icon}</div><div class="tx-info"><strong>${escapeHTML(t.description)}</strong><small>${escapeHTML(t.category)} · ${date}${t.note?' · '+escapeHTML(t.note):''}</small></div><div class="tx-end"><div class="tx-amount ${t.type==='income'?'positive':'negative'}">${t.type==='income'?'+':'−'}${money(Number(t.amount))}</div><button class="delete" data-delete="${escapeHTML(t.id)}" aria-label="حذف ${escapeHTML(t.description)}">حذف</button></div></article>`;
    }).join(''):'<div class="empty">لا توجد معاملات مطابقة.</div>';
  }
  $('jumpToForm').addEventListener('click',()=>{$('description').focus();$('addSection').scrollIntoView({behavior:'smooth',block:'center'});});
  $('transactionForm').addEventListener('submit',e=>{
    e.preventDefault();
    const description=$('description').value.trim(), amount=Number($('amount').value), date=$('date').value;
    if(!description||!Number.isFinite(amount)||amount<=0||!date){notify('تأكد من إدخال الاسم والمبلغ والتاريخ بشكل صحيح.');return;}
    const id=window.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
    transactions.push({id,description,amount,date,type:$('type').value,category:$('category').value,note:$('note').value.trim(),createdAt:Date.now()});
    save();render();$('transactionForm').reset();$('date').value=dateString(new Date());$('type').value='expense';$('category').value='طعام';notify('تمت إضافة المعاملة بنجاح ✓');
  });
  $('saveBudget').addEventListener('click',()=>{
    const value=Number($('budgetInput').value);
    if(!Number.isFinite(value)||value<0||$('budgetInput').value.trim()===''){notify('أدخل ميزانية صحيحة.');return;}
    budget=value;save();render();notify('تم حفظ الميزانية ✓');
  });
  $('transactionList').addEventListener('click',e=>{
    const button=e.target.closest('[data-delete]');if(!button)return;
    const id=button.getAttribute('data-delete'), transaction=transactions.find(t=>t.id===id);if(!transaction)return;
    if(!confirm(`هل تريد حذف المعاملة "${transaction.description}"؟`))return;
    transactions=transactions.filter(t=>t.id!==id);save();render();notify('تم حذف المعاملة.');
  });
  $('filterType').addEventListener('change',renderTransactions);
  $('filterCategory').addEventListener('change',renderTransactions);
  $('type').addEventListener('change',()=>{
    if($('type').value==='income'&&$('category').value!=='راتب')$('category').value='راتب';
    if($('type').value==='expense'&&$('category').value==='راتب')$('category').value='طعام';
  });
  render();
})();
