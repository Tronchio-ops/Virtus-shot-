const STORAGE_KEY = "virtus-shot-tracker-v1";
const POSITIONS = ["Fondo sinistro","45° sinistro","Frontale","45° destro","Fondo destro"];

function pct(made, att){
  const a = Number(att)||0;
  const m = Number(made)||0;
  return a>0 ? (m/a)*100 : 0;
}
function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function load(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"sessions":[]}'); }
  catch{ return {sessions:[]}; }
}
function save(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = load();

// UI
const dateEl = document.getElementById("date");
const attEl = document.getElementById("att");
const notesEl = document.getElementById("notes");
const rowsEl = document.getElementById("rows");
const totMadeEl = document.getElementById("totMade");
const totAttEl = document.getElementById("totAtt");
const totPctEl = document.getElementById("totPct");
const errEl = document.getElementById("err");

const addBtn = document.getElementById("add");
const resetBtn = document.getElementById("reset");
const exportBtn = document.getElementById("export");
const backupBtn = document.getElementById("backup");
const importEl = document.getElementById("import");
const clearBtn = document.getElementById("clear");
const historyEl = document.getElementById("history");

dateEl.value = todayISO();

function buildRows(){
  rowsEl.innerHTML = "";
  const att = Number(attEl.value) || 20;

  POSITIONS.forEach((p)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p}</td>
      <td><input class="made" data-pos="${p}" type="number" min="0" max="${att}" inputmode="numeric" style="width:90px"></td>
      <td class="att">${att}</td>
      <td class="pc">0%</td>
    `;
    rowsEl.appendChild(tr);
  });

  rowsEl.querySelectorAll("input.made").forEach(inp=>{
    inp.addEventListener("input", recomputeTotals);
  });
}

function recomputeTotals(){
  errEl.textContent = "";
  const att = Number(attEl.value) || 0;

  let totalMade = 0;
  rowsEl.querySelectorAll("tr").forEach(tr=>{
    const inp = tr.querySelector("input.made");
    const made = Number(inp.value) || 0;
    totalMade += made;
    tr.querySelector(".att").textContent = att;
    tr.querySelector(".pc").textContent = `${pct(made, att).toFixed(1)}%`;
  });

  const totalAtt = att * POSITIONS.length;
  totMadeEl.textContent = totalMade;
  totAttEl.textContent = totalAtt;
  totPctEl.textContent = `${pct(totalMade, totalAtt).toFixed(1)}%`;
}

function resetForm(){
  dateEl.value = todayISO();
  attEl.value = 20;
  notesEl.value = "";
  buildRows();
  recomputeTotals();
}

function sessionTotals(s){
  const att = Number(s.attemptsPerSpot) || 20;
  const totalMade = POSITIONS.reduce((sum,p)=>sum + (Number(s.made?.[p])||0), 0);
  const totalAtt = att * POSITIONS.length;
  const totalPct = pct(totalMade, totalAtt);
  return { totalMade, totalAtt, totalPct };
}

function addSession(){
  errEl.textContent = "";
  const date = dateEl.value;
  const att = Number(attEl.value);

  if(!date) return errEl.textContent = "Inserisci la data.";
  if(!Number.isFinite(att) || att<=0) return errEl.textContent = "Tentativi per posizione non validi.";

  const made = {};
  let bad = false;

  rowsEl.querySelectorAll("input.made").forEach(inp=>{
    const p = inp.dataset.pos;
    const m = Number(inp.value);
    if(!Number.isFinite(m) || m < 0 || m > att) bad = true;
    made[p] = Number.isFinite(m) ? m : 0;
  });

  if(bad) return errEl.textContent = "Controlla: segnati deve essere tra 0 e tentativi.";

  state.sessions.push({
    id: `${Date.now()}`,
    date,
    attemptsPerSpot: att,
    made,
    notes: notesEl.value || ""
  });

  save(state);
  renderHistory();
  updateChart();
  resetForm();
}

function deleteSession(id){
  state.sessions = state.sessions.filter(s=>s.id !== id);
  save(state);
  renderHistory();
  updateChart();
}

function renderHistory(){
  historyEl.innerHTML = "";
  const sorted = [...state.sessions].sort((a,b)=>String(b.date).localeCompare(String(a.date)));

  sorted.forEach((s, idx)=>{
    const t = sessionTotals(s);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${sorted.length - idx}</td>
      <td>${s.date}</td>
      <td><strong>${t.totalPct.toFixed(1)}%</strong></td>
      <td>${t.totalMade}/${t.totalAtt}</td>
      <td><button data-del="${s.id}">Elimina</button></td>
    `;
    historyEl.appendChild(tr);
  });

  historyEl.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=> deleteSession(btn.dataset.del));
  });
}

function exportCSV(){
  const header = ["id","date","attempts_per_spot",
    ...POSITIONS.flatMap(p=>[`${p}_made`,`${p}_att`,`${p}_pct`]),
    "total_made","total_att","total_pct","notes"
  ];

  const rows = state.sessions
    .slice()
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    .map(s=>{
      const att = Number(s.attemptsPerSpot)||20;
      const madeNums = POSITIONS.map(p=>Number(s.made?.[p])||0);
      const attNums = POSITIONS.map(()=>att);
      const pctNums = madeNums.map(m=>pct(m,att).toFixed(1));
      const totalMade = madeNums.reduce((a,b)=>a+b,0);
      const totalAtt = att * POSITIONS.length;
      const totalPct = pct(totalMade,totalAtt).toFixed(1);
      const cols = [s.id, s.date, att,
        ...POSITIONS.flatMap((p,i)=>[madeNums[i], attNums[i], pctNums[i]]),
        totalMade, totalAtt, totalPct,
        (s.notes||"").replace(/\n/g," ").trim()
      ];

      return cols.map(c=>{
        const str = String(c ?? "");
        if(/[",\n]/.test(str)) return `"${str.replaceAll('"','""')}"`;
        return str;
      }).join(",");
    });

  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `virtus-shot-tracker_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupJSON(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `virtus-shot-tracker_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(String(reader.result || ""));
      if(!parsed?.sessions || !Array.isArray(parsed.sessions)) throw new Error("bad");
      state = { sessions: parsed.sessions };
      save(state);
      renderHistory();
      updateChart();
    }catch{
      errEl.textContent = "Import fallito: JSON non valido.";
    }
  };
  reader.readAsText(file);
}

function clearAll(){
  if(!confirm("Vuoi svuotare TUTTO lo storico?")) return;
  state.sessions = [];
  save(state);
  renderHistory();
  updateChart();
}

addBtn.addEventListener("click", addSession);
resetBtn.addEventListener("click", resetForm);
exportBtn.addEventListener("click", exportCSV);
backupBtn.addEventListener("click", backupJSON);
importEl.addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if(f) importJSON(f);
  importEl.value = "";
});
clearBtn.addEventListener("click", clearAll);

attEl.addEventListener("input", ()=>{
  buildRows();
  recomputeTotals();
});

// Chart
let chart;
function updateChart(){
  const sorted = [...state.sessions]
    .filter(s=>s.date)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));

  const labels = sorted.map(s=>s.date);
  const data = sorted.map(s=>Number(sessionTotals(s).totalPct.toFixed(1)));

  const ctx = document.getElementById("chart");
  if(chart){
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type:"line",
    data:{
      labels,
      datasets:[{
        label:"% Totale",
        data,
        tension:0.25,
        pointRadius:3
      }]
    },
    options:{
      responsive:true,
      scales:{
        y:{ suggestedMin:0, suggestedMax:100, ticks:{ callback:(v)=> v + "%" } }
      }
    }
  });
}

// Init
buildRows();
recomputeTotals();
renderHistory();
updateChart();
