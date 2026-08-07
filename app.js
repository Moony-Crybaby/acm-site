const STORAGE_KEY = "acm-daily-log";

let records = [];
let editingDate = null;

const $ = (id) => document.getElementById(id);

function dateFromOffset(offsetDays) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDateString(offsetDays = 0) {
  return formatDateInput(dateFromOffset(offsetDays));
}

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(raw)) {
      records = raw
        .filter((r) => r && typeof r.date === "string" && Number.isFinite(Number(r.count)))
        .map((r) => ({
          date: r.date,
          count: Math.max(0, Math.floor(Number(r.count))),
          reviewed: Boolean(r.reviewed),
          note: String(r.note || ""),
          problems: Array.isArray(r.problems)
            ? r.problems
                .filter((p) => p && (p.name || p.oj || p.link))
                .map((p) => ({
                  name: String(p.name || "").trim(),
                  oj: String(p.oj || "").trim(),
                  link: String(p.link || "").trim(),
                  reviewed: Boolean(p.reviewed)
                }))
            : []
        }));
      return;
    }
  } catch (_) {
    // fall through to empty list
  }
  records = [];
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getRecord(date) {
  return records.find((r) => r.date === date);
}

function render() {
  renderHeader();
  renderStats();
  renderChart();
  renderTable();
  refreshIcons();
}

function renderHeader() {
  const now = new Date();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const dateText = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
  const today = getRecord(localDateString());
  const status = today
    ? `今天已记录 ${today.count} 题${today.reviewed ? "，已补题" : ""}`
    : "今天还没有记录";
  $("todayLine").textContent = `${dateText} 周${weekdays[now.getDay()]} · ${status}`;
}

function renderStats() {
  const today = getRecord(localDateString());
  const total = records.reduce((sum, r) => sum + r.count, 0);
  const reviewedDays = records.filter((r) => r.reviewed).length;

  $("statToday").textContent = today ? today.count : 0;
  $("statTodayLabel").textContent = today
    ? `今日题数 · ${today.reviewed ? "已补题" : "未补题"}`
    : "今日题数";
  $("statTotal").textContent = total;
  $("statReviewed").textContent = reviewedDays;
  $("statStreak").textContent = computeStreak();
}

function computeStreak() {
  const dates = new Set(records.map((r) => r.date));
  let cursor = dateFromOffset(0);
  if (!dates.has(formatDateInput(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(formatDateInput(cursor))) {
      return 0;
    }
  }
  let streak = 0;
  while (dates.has(formatDateInput(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderChart() {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = dateFromOffset(-i);
    const dateStr = formatDateInput(date);
    const rec = getRecord(dateStr);
    days.push({
      date: dateStr,
      count: rec ? rec.count : 0,
      label: i === 0 ? "今天" : weekdays[date.getDay()]
    });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  $("weekChart").innerHTML = days
    .map((d) => {
      const height = Math.max(d.count === 0 ? 0 : 4, (d.count / maxCount) * 100);
      return `
        <div class="bar-col${d.date === localDateString() ? " today" : ""}" title="${d.date} · ${d.count} 题">
          <span class="bar-value">${d.count || ""}</span>
          <div class="bar-track"><div class="bar" style="--h:${height}%"></div></div>
          <span class="bar-label">${d.label}</span>
        </div>
      `;
    })
    .join("");
}

function formatDateCN(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${dateStr} ${weekdays[d.getDay()]}`;
}

function renderTable() {
  const body = $("recordBody");
  if (records.length === 0) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6">还没有记录</td></tr>`;
    return;
  }

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  body.innerHTML = sorted
    .map(
      (r) => `
        <tr>
          <td>${formatDateCN(r.date)}</td>
          <td class="count-cell">${r.count} 题</td>
          <td><span class="badge ${r.reviewed ? "ok" : "warn"}">${r.reviewed ? "已补" : "未补"}</span></td>
          <td class="problem-cell" title="${escapeHtml(formatProblemNames(r))}">${escapeHtml(formatProblemNames(r)) || "—"}</td>
          <td class="note-cell" title="${escapeHtml(r.note)}">${escapeHtml(r.note) || "—"}</td>
          <td class="actions">
            <button class="icon-btn" type="button" data-action="edit" data-date="${r.date}" title="编辑">
              <i data-lucide="pencil"></i>
            </button>
            <button class="icon-btn danger" type="button" data-action="delete" data-date="${r.date}" title="删除">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `
    )
    .join("");
}

function formatProblemNames(record) {
  const problems = record.problems || [];
  if (problems.length === 0) {
    return "";
  }
  const names = problems.map((p) => p.name || p.oj || p.link).filter(Boolean);
  if (names.length <= 3) {
    return names.join("、");
  }
  return `${names.slice(0, 3).join("、")} 等 ${problems.length} 题`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function enterEdit(record) {
  editingDate = record.date;
  $("dateInput").value = record.date;
  $("dateInput").disabled = true;
  $("countInput").value = record.count;
  $("reviewInput").checked = record.reviewed;
  $("noteInput").value = record.note;
  renderProblemRows(record.problems || []);
  $("submitBtn").innerHTML = '<i data-lucide="check"></i><span>保存</span>';
  $("cancelBtn").hidden = false;
  $("logForm").scrollIntoView({ behavior: "smooth", block: "center" });
  refreshIcons();
}

function resetForm(keepDate = false) {
  editingDate = null;
  if (!keepDate) {
    $("dateInput").value = localDateString();
  }
  $("dateInput").disabled = false;
  $("countInput").value = 0;
  $("reviewInput").checked = false;
  $("noteInput").value = "";
  renderProblemRows([]);
  $("submitBtn").innerHTML = '<i data-lucide="plus"></i><span>记录</span>';
  $("cancelBtn").hidden = true;
  refreshIcons();
}

function problemRowHTML(problem = {}) {
  const name = escapeHtml(problem.name || "");
  const oj = escapeHtml(problem.oj || "");
  const link = escapeHtml(problem.link || "");
  const checked = problem.reviewed ? "checked" : "";
  return `
    <div class="problem-row">
      <input type="text" class="p-name" value="${name}" placeholder="题目 / 题号">
      <input type="text" class="p-oj" value="${oj}" placeholder="OJ">
      <input type="text" class="p-link" value="${link}" placeholder="链接（可选）">
      <label class="p-review"><input type="checkbox" class="p-reviewed" ${checked}><span>补题</span></label>
      <button class="icon-btn danger" type="button" data-remove-row title="删除这一题"><i data-lucide="x"></i></button>
    </div>
  `;
}

function renderProblemRows(problems) {
  const container = $("problemRows");
  container.innerHTML = "";
  const list = problems && problems.length > 0 ? problems : [{}];
  list.forEach((problem) => {
    container.insertAdjacentHTML("beforeend", problemRowHTML(problem));
  });
  updateCountFromRows();
  refreshIcons();
}

function collectProblems() {
  return [...document.querySelectorAll("#problemRows .problem-row")]
    .map((row) => ({
      name: row.querySelector(".p-name").value.trim(),
      oj: row.querySelector(".p-oj").value.trim(),
      link: row.querySelector(".p-link").value.trim(),
      reviewed: row.querySelector(".p-reviewed").checked
    }))
    .filter((p) => p.name || p.oj || p.link);
}

function updateCountFromRows() {
  const named = [...document.querySelectorAll("#problemRows .problem-row")].filter(
    (row) => row.querySelector(".p-name").value.trim()
  ).length;
  if (named > 0) {
    $("countInput").value = named;
  }
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

$("logForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const date = $("dateInput").value;
  if (!date) {
    $("dateInput").focus();
    return;
  }
  const count = Math.max(0, Math.floor(Number($("countInput").value) || 0));
  const problems = collectProblems();
  const record = {
    date,
    count: problems.length > 0 ? problems.length : count,
    reviewed: $("reviewInput").checked,
    note: $("noteInput").value.trim(),
    problems
  };

  const existingIndex = records.findIndex((r) => r.date === date);
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }
  saveRecords();
  resetForm();
  render();
});

$("dateInput").addEventListener("change", () => {
  const date = $("dateInput").value;
  if (!date) {
    return;
  }
  const existing = getRecord(date);
  if (existing) {
    enterEdit(existing);
  } else if (editingDate) {
    resetForm(true);
  }
});

$("cancelBtn").addEventListener("click", () => {
  resetForm();
  renderHeader();
});

$("addProblemBtn").addEventListener("click", () => {
  $("problemRows").insertAdjacentHTML("beforeend", problemRowHTML());
  updateCountFromRows();
  refreshIcons();
});

$("problemRows").addEventListener("input", updateCountFromRows);
$("problemRows").addEventListener("change", updateCountFromRows);
$("problemRows").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove-row]");
  if (!button) {
    return;
  }
  button.closest(".problem-row").remove();
  updateCountFromRows();
});

$("recordBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const date = button.dataset.date;
  if (button.dataset.action === "edit") {
    const record = getRecord(date);
    if (record) {
      enterEdit(record);
    }
  } else if (button.dataset.action === "delete") {
    if (window.confirm(`确认删除 ${date} 的记录？`)) {
      records = records.filter((r) => r.date !== date);
      saveRecords();
      if (editingDate === date) {
        resetForm();
      }
      render();
    }
  }
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `acm-log-${localDateString()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$("importInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) {
        throw new Error("invalid file");
      }
      records = data
        .filter((r) => r && typeof r.date === "string" && Number.isFinite(Number(r.count)))
        .map((r) => ({
          date: r.date,
          count: Math.max(0, Math.floor(Number(r.count))),
          reviewed: Boolean(r.reviewed),
          note: String(r.note || ""),
          problems: Array.isArray(r.problems)
            ? r.problems
                .filter((p) => p && (p.name || p.oj || p.link))
                .map((p) => ({
                  name: String(p.name || "").trim(),
                  oj: String(p.oj || "").trim(),
                  link: String(p.link || "").trim(),
                  reviewed: Boolean(p.reviewed)
                }))
            : []
        }));
      saveRecords();
      resetForm();
      render();
      window.alert(`导入成功，共 ${records.length} 条记录`);
    } catch (_) {
      window.alert("导入失败：请选择正确的 JSON 备份文件");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});

loadRecords();
resetForm();
render();
