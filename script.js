// Keys
const TASKS_KEY = "tasks_v1";
const CATS_KEY = "categories_v1";
const TASKS_BACKUP_KEY = "tasks_v1_backup_on_parse_error";

// Elements
const taskInput = document.getElementById("taskInput");
const dateInput = document.getElementById("dateInput");
const priorityInput = document.getElementById("priorityInput");
const categoryInput = document.getElementById("categoryInput");
const categoryListEl = document.getElementById("categoryList");
const categoryDropdown = document.getElementById("categoryDropdown");
const pickedCategoryEl = document.getElementById("pickedCategory");
const remarksInput = document.getElementById("remarksInput");
const addBtn = document.getElementById("addBtn");
const taskList = document.getElementById("taskList");
const progress = document.getElementById("progress");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const clearCompletedBtn = document.getElementById("clearCompletedBtn");
const searchInput = document.getElementById("searchInput");
const filterAllBtn = document.getElementById("filterAll");
const filterActiveBtn = document.getElementById("filterActive");
const filterCompletedBtn = document.getElementById("filterCompleted");
const filterButtons = document.querySelectorAll(".filters .filter");
const sortSelect = document.getElementById("sortSelect");

// Edit modal
const editModal = document.getElementById("editModal");
const editText = document.getElementById("editText");
const editDate = document.getElementById("editDate");
const editPriority = document.getElementById("editPriority");
const editCategory = document.getElementById("editCategory");
const editRemarks = document.getElementById("editRemarks");
const saveEditBtn = document.getElementById("saveEditBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// State
let tasks = [];
let categories = [];
let currentFilter = "active";
let currentSearch = "";
let currentSort = "created_desc";
let editingId = null;

// Utilities
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function safeParse(key){
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try { return JSON.parse(raw); }
  catch (err) {
    try { localStorage.setItem(TASKS_BACKUP_KEY, raw); } catch(e){}
    console.warn(`Parse error for ${key}, backed up raw value.`);
    return null;
  }
}

// Persistence
function saveTasks(){ try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch(e){ console.warn(e); } }
function loadTasks(){ const p = safeParse(TASKS_KEY); return Array.isArray(p) ? p : []; }
function saveCategories(){ try { localStorage.setItem(CATS_KEY, JSON.stringify(categories)); } catch(e){ console.warn(e); } }
function loadCategories(){ const p = safeParse(CATS_KEY); return Array.isArray(p) ? p : []; }

// Datalist & custom dropdown
function populateCategoryDatalist(){
  categoryListEl.innerHTML = "";
  categoryDropdown.innerHTML = "";
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    categoryListEl.appendChild(opt);

    const item = document.createElement("div");
    item.className = "category-item";
    item.setAttribute("role","option");
    item.innerHTML = `<div class="label">${escapeHtml(cat)}</div>
                      <div>
                        <button class="remove-cat" title="Remove category" aria-label="Remove ${escapeHtml(cat)}">✕</button>
                      </div>`;
    item.querySelector(".label").addEventListener("click", () => {
      categoryInput.value = cat;
      updatePickedCategoryUI();
      hideCategoryDropdown();
      // do not auto-focus to avoid keyboard pop on mobile; focus only if user tapped intentionally
    });
    item.querySelector(".remove-cat").addEventListener("click", (e) => {
      e.stopPropagation();
      removeCategory(cat);
    });
    categoryDropdown.appendChild(item);
  });
  updatePickedCategoryUI();
}

// Escape HTML for safe insertion
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// Show/hide dropdown
function showCategoryDropdown(){
  if (!categories.length) return;
  categoryDropdown.classList.remove("hidden");
  categoryInput.setAttribute("aria-expanded","true");
}
function hideCategoryDropdown(){
  categoryDropdown.classList.add("hidden");
  categoryInput.setAttribute("aria-expanded","false");
}

// Category pill UI and removal
function updatePickedCategoryUI(){
  const val = categoryInput.value.trim();
  if (!val) { pickedCategoryEl.classList.add("hidden"); pickedCategoryEl.innerHTML = ""; return; }
  const match = categories.find(c => c.toLowerCase() === val.toLowerCase());
  if (!match) { pickedCategoryEl.classList.add("hidden"); pickedCategoryEl.innerHTML = ""; return; }
  pickedCategoryEl.classList.remove("hidden");
  pickedCategoryEl.innerHTML = "";
  const span = document.createElement("span"); span.textContent = match;
  const remove = document.createElement("button"); remove.className = "remove"; remove.title = "Remove saved category";
  remove.innerHTML = "✕";
  remove.addEventListener("click", (e) => {
    e.stopPropagation();
    removeCategory(match);
  });
  pickedCategoryEl.appendChild(span);
  pickedCategoryEl.appendChild(remove);
}

// Remove category from saved list
function removeCategory(cat){
  categories = categories.filter(c => c !== cat);
  saveCategories();
  populateCategoryDatalist();
  if (categoryInput.value.trim().toLowerCase() === cat.toLowerCase()){
    categoryInput.value = "";
    updatePickedCategoryUI();
  }
}

// Formatting
function formatDueDate(d){
  if (!d) return "No date";
  const dt = new Date(d + "T00:00:00");
  const day = String(dt.getDate()).padStart(2,"0");
  const month = String(dt.getMonth()+1).padStart(2,"0");
  const year = dt.getFullYear();
  const weekday = dt.toLocaleDateString(undefined, { weekday: 'short' });
  return `${day}/${month}/${year}, ${weekday}`;
}
function formatCreated(ts){
  const dt = new Date(ts);
  const day = String(dt.getDate()).padStart(2,"0");
  const month = String(dt.getMonth()+1).padStart(2,"0");
  const year = dt.getFullYear();
  const weekday = dt.toLocaleDateString(undefined, { weekday: 'short' });
  const hh = String(dt.getHours()).padStart(2,"0");
  const mm = String(dt.getMinutes()).padStart(2,"0");
  return `${day}/${month}/${year}, ${weekday} ${hh}:${mm}`;
}
function categoryColor(name){
  if (!name) return '#999';
  let h=0; for(let i=0;i<name.length;i++) h=(h<<5)-h+name.charCodeAt(i);
  h = Math.abs(h)%360;
  return `hsl(${h} 70% 45%)`;
}
function priorityClass(priority){
  if (!priority) return "priority-medium";
  if (priority.toLowerCase()==="high") return "priority-high";
  if (priority.toLowerCase()==="low") return "priority-low";
  return "priority-medium";
}
function isOverdue(task){
  if (!task.date) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const tDate = new Date(task.date + "T00:00:00");
  return (tDate < today) && !task.completed;
}

// Rendering & counts
function updateProgress(){ const completed = tasks.filter(t=>t.completed).length; progress.textContent = `Progress: ${completed} of ${tasks.length} tasks`; }

function updateFilterCounts(){
  const all = tasks.length;
  const active = tasks.filter(t=>!t.completed).length;
  const completed = tasks.filter(t=>t.completed).length;
  filterAllBtn.textContent = `All (${all})`;
  filterActiveBtn.textContent = `Active (${active})`;
  filterCompletedBtn.textContent = `Completed (${completed})`;
}

function sortTasks(arr, mode){
  const copy = [...arr];

  if (mode === "created_desc") return copy.sort((a,b)=> b.created - a.created);
  if (mode === "created_asc") return copy.sort((a,b)=> a.created - b.created);

  if (mode === "priority_desc") {
    const rank = {High:3, Medium:2, Low:1};
    return copy.sort((a,b)=> rank[b.priority]-rank[a.priority]);
  }
  if (mode === "priority_asc") {
    const rank = {High:3, Medium:2, Low:1};
    return copy.sort((a,b)=> rank[a.priority]-rank[b.priority]);
  }

  if (mode === "date_asc") {
    return copy.sort((a,b)=> (a.date||"9999-12-31").localeCompare(b.date||"9999-12-31"));
  }
  if (mode === "date_desc") {
    return copy.sort((a,b)=> (b.date||"0000-01-01").localeCompare(a.date||"0000-01-01"));
  }

  // Category sorting (new)
  if (mode === "category_asc") {
    return copy.sort((a,b) => {
      const ca = (a.category || "").toLowerCase();
      const cb = (b.category || "").toLowerCase();
      if (ca < cb) return -1;
      if (ca > cb) return 1;
      return b.created - a.created;
    });
  }
  if (mode === "category_desc") {
    return copy.sort((a,b) => {
      const ca = (a.category || "").toLowerCase();
      const cb = (b.category || "").toLowerCase();
      if (ca > cb) return -1;
      if (ca < cb) return 1;
      return b.created - a.created;
    });
  }

  return copy;
}

function renderTasks(filter=currentFilter, search=currentSearch, sortMode=currentSort){
  taskList.innerHTML = "";
  let list = tasks.slice();
  if (filter==="active") list = list.filter(t=>!t.completed);
  if (filter==="completed") list = list.filter(t=>t.completed);
  if (search && search.trim()){
    const q = search.toLowerCase();
    list = list.filter(t => (t.text && t.text.toLowerCase().includes(q)) || (t.category && t.category.toLowerCase().includes(q)) || (t.remarks && t.remarks.toLowerCase().includes(q)));
  }
  list = sortTasks(list, sortMode);

  list.forEach(task => {
    const li = document.createElement("li"); li.className = "task";
    if (task.completed) li.classList.add("completed");
    if (isOverdue(task)) li.classList.add("overdue");

    const left = document.createElement("div"); left.className = "left";

    const cb = document.createElement("div"); cb.className = "checkbox" + (task.completed ? " checked" : "");
    cb.title = task.completed ? "Mark as active" : "Mark as completed";
    cb.textContent = task.completed ? "✓" : "";
    cb.addEventListener("click", ()=> toggleTask(task.id));
    cb.setAttribute("role","button"); cb.setAttribute("aria-pressed", String(!!task.completed)); cb.tabIndex = 0;
    cb.addEventListener("keydown", e => { if (e.key==="Enter"||e.key===" ") toggleTask(task.id); });

    const info = document.createElement("div"); info.className = "info-block";

    // Line 1: title + category badge + priority badge
    const line1 = document.createElement("div"); line1.className = "info-line line-title";
    const title = document.createElement("div"); title.className = "title"; title.textContent = task.text; title.title = task.text;
    line1.appendChild(title);

    const catBadge = document.createElement("span"); catBadge.className = "cat-badge"; catBadge.textContent = task.category || "General";
    catBadge.style.background = categoryColor(task.category || "General");
    catBadge.title = `Category: ${task.category || "General"}`;
    catBadge.addEventListener("click", ()=> {
      categoryInput.value = task.category || "";
      updatePickedCategoryUI();
      // do not auto-focus on mobile
    });
    line1.appendChild(catBadge);

    const pBadge = document.createElement("span"); pBadge.className = `priority-badge ${priorityClass(task.priority)}`; pBadge.textContent = task.priority || "Medium";
    line1.appendChild(pBadge);

    // Line 2: due date & created date/time
    const line2 = document.createElement("div"); line2.className = "info-line line-meta";
    const dateStr = task.date ? formatDueDate(task.date) : "No date";
    const createdStr = formatCreated(task.created);
    line2.textContent = `Due: ${dateStr}   •   Created: ${createdStr}`;

    // Line 3: remarks
    const line3 = document.createElement("div"); line3.className = "info-line line-remarks";
    line3.textContent = task.remarks || "";

    info.appendChild(line1);
    info.appendChild(line2);
    info.appendChild(line3);

    left.appendChild(cb);
    left.appendChild(info);

    const actions = document.createElement("div"); actions.className = "actions";

    const editBtn = document.createElement("button"); editBtn.className = "icon-btn"; editBtn.title = "Edit";
    editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21v-3.6l11.1-11.1 3.6 3.6L6.6 21H3z"></path><path d="M14.7 6.3l3 3"></path></svg>`;
    editBtn.addEventListener("click", ()=> openEdit(task.id));

    const delBtn = document.createElement("button"); delBtn.className = "icon-btn"; delBtn.title = "Delete";
    delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>`;
    delBtn.addEventListener("click", ()=> deleteTask(task.id));

    actions.appendChild(editBtn); actions.appendChild(delBtn);

    li.appendChild(left); li.appendChild(actions);
    taskList.appendChild(li);
  });

  updateProgress();
  updateFilterCounts();
}

// CRUD
function addTask(){
  const text = taskInput.value.trim();
  if (!text){ taskInput.classList.add("shake"); setTimeout(()=>taskInput.classList.remove("shake"),300); taskInput.focus(); return; }
  const cat = categoryInput.value.trim() || "General";
  const newTask = { id: uid(), text, date: dateInput.value || "", priority: priorityInput.value || "High", category: cat, remarks: remarksInput.value.trim() || "", completed: false, created: Date.now() };
  tasks.push(newTask); saveTasks();

  if (cat && !categories.includes(cat)){ categories.unshift(cat); categories = categories.slice(0,30); saveCategories(); populateCategoryDatalist(); }

  clearInputs();
  currentFilter = "active";
  filterButtons.forEach(b => b.classList.toggle("active", b.dataset.filter === "active"));
  renderTasks();
  // on mobile avoid forcing keyboard; do not auto-focus
}

function clearInputs(){ taskInput.value=""; dateInput.value = new Date().toISOString().slice(0,10); categoryInput.value=""; remarksInput.value=""; priorityInput.value="High"; updatePickedCategoryUI(); hideCategoryDropdown(); }

function toggleTask(id){ const t = tasks.find(x=>x.id===id); if(!t) return; t.completed = !t.completed; saveTasks(); renderTasks(); }
function deleteTask(id){ if(!confirm("Delete this task?")) return; tasks = tasks.filter(t=>t.id!==id); saveTasks(); renderTasks(); }
function deleteAllTasks(){ if(!tasks.length) return; if(!confirm("Delete all tasks? This cannot be undone.")) return; tasks=[]; saveTasks(); renderTasks(); }
function clearCompleted(){ const any = tasks.some(t=>t.completed); if(!any){ alert("No completed tasks to clear."); return; } if(!confirm("Clear all completed tasks?")) return; tasks = tasks.filter(t=>!t.completed); saveTasks(); renderTasks(); }

// Edit
function openEdit(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  editingId = id;
  editText.value = t.text; editDate.value = t.date || ""; editPriority.value = t.priority || "High"; editCategory.value = t.category || ""; editRemarks.value = t.remarks || "";
  editModal.classList.remove("hidden"); editText.focus();
}
function closeEdit(){ editingId = null; editModal.classList.add("hidden"); }
function saveEdit(){
  if(!editingId) return;
  const t = tasks.find(x=>x.id===editingId); if(!t) return;
  const newCat = editCategory.value.trim() || "General";
  t.text = editText.value.trim() || t.text; t.date = editDate.value || ""; t.priority = editPriority.value || "High"; t.category = newCat; t.remarks = editRemarks.value.trim() || "";
  saveTasks();
  if (newCat && !categories.includes(newCat)){ categories.unshift(newCat); categories = categories.slice(0,30); saveCategories(); populateCategoryDatalist(); }
  closeEdit(); renderTasks();
}

// Persistence helpers
function saveCategories(){ try{ localStorage.setItem(CATS_KEY, JSON.stringify(categories)); } catch(e){ console.warn(e); } }
function loadInitial(){
  const parsedTasks = safeParse(TASKS_KEY); tasks = Array.isArray(parsedTasks) ? parsedTasks : [];
  const parsedCats = safeParse(CATS_KEY); categories = Array.isArray(parsedCats) ? parsedCats : [];
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
  populateCategoryDatalist();
  filterButtons.forEach(b => b.classList.toggle("active", b.dataset.filter === currentFilter));
  renderTasks();
}

// Events & UX
addBtn.addEventListener("click", addTask);
taskInput.addEventListener("keydown", e => { if (e.key==="Enter") addTask(); });
categoryInput.addEventListener("input", () => { updatePickedCategoryUI(); populateCategoryDatalist(); });
categoryInput.addEventListener("focus", () => { populateCategoryDatalist(); showCategoryDropdown(); });
categoryInput.addEventListener("blur", () => { setTimeout(hideCategoryDropdown, 200); });
categoryInput.addEventListener("keydown", e => { if (e.key==="Enter") addTask(); });

remarksInput.addEventListener("keydown", e => { if (e.key==="Enter") addTask(); });

deleteAllBtn.addEventListener("click", deleteAllTasks);
clearCompletedBtn.addEventListener("click", clearCompleted);

searchInput.addEventListener("input", e => { currentSearch = e.target.value; renderTasks(); });

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

sortSelect.addEventListener("change", e => { currentSort = e.target.value; renderTasks(); });

saveEditBtn.addEventListener("click", saveEdit);
cancelEditBtn.addEventListener("click", closeEdit);
editModal.addEventListener("click", (e)=> { if (e.target === editModal) closeEdit(); });
document.addEventListener("keydown", (e)=> { if (e.key === "Escape" && !editModal.classList.contains("hidden")) closeEdit(); });

// Cross-tab sync
window.addEventListener("storage", (e) => {
  if (e.key === TASKS_KEY){
    const newTasks = safeParse(TASKS_KEY);
    if (Array.isArray(newTasks)){ tasks = newTasks; renderTasks(); }
  }
  if (e.key === CATS_KEY){
    const newCats = safeParse(CATS_KEY);
    if (Array.isArray(newCats)){ categories = newCats; populateCategoryDatalist(); }
  }
});

// Init
loadInitial();
