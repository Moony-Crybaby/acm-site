const STORAGE_KEY = "acm-daily-log";
const TEMPLATE_KEY = "acm-templates";
const CODE_KEY = "acm-code-lib";

let records = [];
let editingDate = null;
let templates = [];
let codeLib = [];
let editingTemplateId = null;
let editingCodeId = null;

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
        .map(normalizeRecord);
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

function normalizeRecord(r) {
  return {
    date: String(r.date || ""),
    count: Math.max(0, Math.floor(Number(r.count) || 0)),
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
  };
}

function normalizeTemplate(t) {
  return {
    id: String(t.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    title: String(t.title || "").trim(),
    category: String(t.category || "").trim(),
    tags: String(t.tags || "").trim(),
    note: String(t.note || "").trim(),
    code: String(t.code || ""),
    updatedAt: Number(t.updatedAt) || Date.now()
  };
}

function normalizeCodeEntry(c) {
  return {
    id: String(c.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    title: String(c.title || "").trim(),
    oj: String(c.oj || "").trim(),
    link: String(c.link || "").trim(),
    category: String(c.category || "").trim(),
    tags: String(c.tags || "").trim(),
    note: String(c.note || "").trim(),
    code: String(c.code || ""),
    date: String(c.date || "")
  };
}

function render() {
  renderHeader();
  renderStats();
  renderChart30();
  renderChartMonths();
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
  $("statWeek7").textContent = problemsSince(localDateString(-6));
  $("statMonth30").textContent = problemsSince(localDateString(-29));
  $("statThisMonth").textContent = problemsSince(firstOfMonthString());
  $("statMonthStreak").textContent = computeMonthStreak();
  $("statYear").textContent = problemsSince(localDateString(-364));
}

function problemsSince(startDate) {
  return records
    .filter((r) => r.date >= startDate)
    .reduce((sum, r) => sum + r.count, 0);
}

function firstOfMonthString() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  first.setHours(12, 0, 0, 0);
  return formatDateInput(first);
}

function streakFrom(anchor, minDate) {
  const dates = new Set(records.map((r) => r.date));
  let cursor = new Date(anchor);
  cursor.setHours(12, 0, 0, 0);
  if (!dates.has(formatDateInput(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(formatDateInput(cursor))) {
      return 0;
    }
  }
  let streak = 0;
  while (dates.has(formatDateInput(cursor)) && formatDateInput(cursor) >= minDate) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeStreak() {
  return streakFrom(new Date(), "0000-01-01");
}

function computeMonthStreak() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return streakFrom(now, firstOfMonthString());
}

function renderChart30() {
  const days = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = dateFromOffset(-i);
    const dateStr = formatDateInput(date);
    const rec = getRecord(dateStr);
    days.push({
      date: dateStr,
      count: rec ? rec.count : 0,
      label: i === 0 ? "今天" : i % 5 === 0 ? `${date.getMonth() + 1}/${date.getDate()}` : ""
    });
  }
  renderBars($("chart30"), days);
}

function renderChartMonths() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const months = [];
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    date.setHours(12, 0, 0, 0);
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      date: prefix,
      count: records.filter((r) => r.date.startsWith(prefix)).reduce((sum, r) => sum + r.count, 0),
      label: `${date.getMonth() + 1}月`
    });
  }
  renderBars($("chartMonths"), months);
}

function renderBars(container, items) {
  const maxCount = Math.max(1, ...items.map((d) => d.count));
  container.innerHTML = items
    .map((d) => {
      const height = Math.max(d.count === 0 ? 0 : 4, (d.count / maxCount) * 100);
      return `
        <div class="bar-col${d.date === localDateString() ? " today" : ""}" title="${d.date} · ${d.count} 题">
          <span class="bar-value">${d.count || ""}</span>
          <div class="bar-track"><div class="bar" style="--h:${height}%"></div></div>
          <span class="bar-label">${escapeHtml(d.label)}</span>
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

  const rows = [];
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  sorted.forEach((r) => {
    const problems = r.problems || [];
    if (problems.length === 0) {
      rows.push({
        date: r.date,
        label: `共 ${r.count} 题`,
        link: "",
        oj: "",
        reviewed: r.reviewed,
        note: r.note
      });
      return;
    }
    problems.forEach((p) => {
      rows.push({
        date: r.date,
        label: p.name || p.oj || p.link || "未命名",
        link: p.link,
        oj: p.oj,
        reviewed: p.reviewed || r.reviewed,
        note: r.note
      });
    });
  });

  body.innerHTML = rows
    .map((row) => {
      const title = row.link
        ? `<a class="problem-link" href="${escapeHtml(row.link)}" target="_blank" rel="noopener">${escapeHtml(row.label)}</a>`
        : escapeHtml(row.label);
      return `
        <tr>
          <td>${formatDateCN(row.date)}</td>
          <td class="problem-cell" title="${escapeHtml(row.label)}">${title}</td>
          <td>${escapeHtml(row.oj) || "—"}</td>
          <td><span class="badge ${row.reviewed ? "ok" : "warn"}">${row.reviewed ? "已补" : "未补"}</span></td>
          <td class="note-cell" title="${escapeHtml(row.note)}">${escapeHtml(row.note) || "—"}</td>
          <td class="actions">
            <button class="icon-btn" type="button" data-action="edit" data-date="${row.date}" title="编辑">
              <i data-lucide="pencil"></i>
            </button>
            <button class="icon-btn danger" type="button" data-action="delete" data-date="${row.date}" title="删除">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function problemNamesText(record) {
  const problems = record.problems || [];
  if (problems.length === 0) {
    return "";
  }
  const names = problems.map((p) => p.name || p.oj || p.link).filter(Boolean);
  return joinProblemNames(names, problems.length);
}

function problemNamesHtml(record) {
  const problems = record.problems || [];
  if (problems.length === 0) {
    return "";
  }
  const names = problems.map((p) => {
    const label = p.name || p.oj || p.link;
    if (!p.link) {
      return escapeHtml(label);
    }
    return `<a class="problem-link" href="${escapeHtml(p.link)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
  });
  return joinProblemNames(names, problems.length);
}

function joinProblemNames(names, total) {
  if (names.length <= 3) {
    return names.join("、");
  }
  return `${names.slice(0, 3).join("、")} 等 ${total} 题`;
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

function parseProblemLink(rawUrl) {
  let raw = String(rawUrl || "").trim();
  if (!raw) {
    return null;
  }
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return null;
  }
  const href = url.href;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let match;

  match = href.match(/codeforces\.com\/problemset\/problem\/(\d+)\/([A-Z0-9]+)/i);
  if (match) {
    return { oj: "Codeforces", name: `CF ${match[1]}${match[2].toUpperCase()}` };
  }

  match = href.match(/codeforces\.com\/contest\/(\d+)\/problem\/([A-Z0-9]+)/i);
  if (match) {
    return { oj: "Codeforces", name: `CF ${match[1]}${match[2].toUpperCase()}` };
  }

  match = href.match(/codeforces\.com\/gym\/(\d+)\/problem\/([A-Z0-9]+)/i);
  if (match) {
    return { oj: "Codeforces", name: `CF Gym ${match[1]}${match[2].toUpperCase()}` };
  }

  match = href.match(/luogu\.com\.cn\/problem\/([A-Z0-9]+)/i);
  if (match) {
    return { oj: "洛谷", name: match[1].toUpperCase() };
  }

  match = href.match(/atcoder\.jp\/contests\/([a-z0-9_]+)\/tasks\/([a-z0-9_]+)/i);
  if (match) {
    const parts = match[2].split("_");
    const letter = parts.length > 1 ? ` ${parts[parts.length - 1].toUpperCase()}` : "";
    return { oj: "AtCoder", name: `${match[1].toUpperCase()}${letter}` };
  }

  match = href.match(/ac\.nowcoder\.com\/acm\/contest\/(\d+)\/([A-Z0-9]+)/i);
  if (match) {
    return { oj: "牛客", name: `NC ${match[1]}${match[2].toUpperCase()}` };
  }

  match = href.match(/ac\.nowcoder\.com\/acm\/problem\/([A-Z0-9]+)/i);
  if (match) {
    return { oj: "牛客", name: `NC ${match[1].toUpperCase()}` };
  }

  match = href.match(/leetcode[^/]*\.[a-z]{2,}\/problems\/([a-z0-9-]+)/i);
  if (match) {
    const name = match[1]
      .split("-")
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");
    return { oj: "LeetCode", name };
  }

  const hostMap = {
    "codeforces.com": "Codeforces",
    "atcoder.jp": "AtCoder",
    "luogu.com.cn": "洛谷",
    "ac.nowcoder.com": "牛客",
    "leetcode.com": "LeetCode",
    "leetcode.cn": "力扣",
    "vjudge.net": "VJudge",
    "acm.hdu.edu.cn": "HDU",
    "poj.org": "POJ",
    "codechef.com": "CodeChef"
  };
  const oj = hostMap[host] || host;
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (!last) {
    return null;
  }
  let name;
  try {
    name = decodeURIComponent(last);
  } catch (_) {
    name = last;
  }
  return { oj, name };
}

function autoFillFromLink(row) {
  const linkInput = row.querySelector(".p-link");
  const nameInput = row.querySelector(".p-name");
  const ojInput = row.querySelector(".p-oj");
  const parsed = parseProblemLink(linkInput.value);
  if (!parsed) {
    row.dataset.auto = "";
    return false;
  }
  if (row.dataset.auto === "1") {
    nameInput.value = "";
    ojInput.value = "";
  }
  if (!nameInput.value) {
    nameInput.value = parsed.name;
  }
  if (!ojInput.value) {
    ojInput.value = parsed.oj;
  }
  row.dataset.auto = "1";
  return true;
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

$("problemRows").addEventListener("input", (event) => {
  updateCountFromRows();
  const row = event.target.closest(".problem-row");
  if (!row || !event.target.classList.contains("p-link")) {
    return;
  }
  const hadName = row.querySelector(".p-name").value.trim();
  const hadOj = row.querySelector(".p-oj").value.trim();
  const filled = autoFillFromLink(row);
  if (filled && !hadName && !hadOj && row === $("problemRows").lastElementChild) {
    $("problemRows").insertAdjacentHTML("beforeend", problemRowHTML());
    refreshIcons();
  }
});
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

function loadTemplates() {
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATE_KEY));
    templates = Array.isArray(raw) ? raw.map(normalizeTemplate) : [];
  } catch (_) {
    templates = [];
  }
}

function saveTemplates() {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

function loadCodeLib() {
  try {
    const raw = JSON.parse(localStorage.getItem(CODE_KEY));
    codeLib = Array.isArray(raw) ? raw.map(normalizeCodeEntry) : [];
  } catch (_) {
    codeLib = [];
  }
}

function saveCodeLib() {
  localStorage.setItem(CODE_KEY, JSON.stringify(codeLib));
}

function switchView(name) {
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = true;
  });
  $(`view-${name}`).hidden = false;
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === name);
  });
  refreshIcons();
}

function renderTemplateCategories() {
  const categories = new Set(["图论", "动态规划", "数据结构", "数论", "字符串", "计算几何", "搜索", "贪心"]);
  templates.forEach((t) => {
    if (t.category) {
      categories.add(t.category);
    }
  });
  $("categoryList").innerHTML = [...categories]
    .map((c) => `<option value="${escapeHtml(c)}">`)
    .join("");
}

function templateMatches(template, query) {
  const text = [template.title, template.category, template.tags, template.note].join(" ").toLowerCase();
  return text.includes(query);
}

function templateCardHtml(template) {
  const meta = [template.category, template.tags].filter(Boolean).join(" · ");
  return `
    <article class="lib-card">
      <div class="lib-card-head">
        <div>
          <h3>${escapeHtml(template.title) || "未命名模板"}</h3>
          ${meta ? `<div class="lib-meta">${escapeHtml(meta)}</div>` : ""}
        </div>
        <div class="lib-card-actions">
          <button class="icon-btn" type="button" data-template-action="copy" data-id="${escapeHtml(template.id)}" title="复制代码">
            <i data-lucide="copy"></i>
          </button>
          <button class="icon-btn" type="button" data-template-action="edit" data-id="${escapeHtml(template.id)}" title="编辑">
            <i data-lucide="pencil"></i>
          </button>
          <button class="icon-btn danger" type="button" data-template-action="delete" data-id="${escapeHtml(template.id)}" title="删除">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
      ${template.note ? `<p class="lib-note">${escapeHtml(template.note)}</p>` : ""}
      <pre class="lib-code"><code>${escapeHtml(template.code)}</code></pre>
    </article>
  `;
}

function renderTemplates() {
  const query = $("templateSearch").value.trim().toLowerCase();
  const list = templates.filter((t) => !query || templateMatches(t, query));
  $("templateCount").textContent = templates.length;
  renderTemplateCategories();
  if (list.length === 0) {
    $("templateGrid").innerHTML = `<div class="empty-lib">模板库还是空的</div>`;
  } else {
    $("templateGrid").innerHTML = list.map(templateCardHtml).join("");
  }
  refreshIcons();
}

function openTemplateForm(template = null) {
  editingTemplateId = template ? template.id : null;
  $("templateFormTitle").textContent = template ? "编辑模板" : "添加模板";
  $("templateTitle").value = template ? template.title : "";
  $("templateCategory").value = template ? template.category : "";
  $("templateTags").value = template ? template.tags : "";
  $("templateNote").value = template ? template.note : "";
  $("templateCode").value = template ? template.code : "";
  $("templateFormPanel").hidden = false;
  $("templateFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  refreshIcons();
}

function closeTemplateForm() {
  editingTemplateId = null;
  $("templateFormPanel").hidden = true;
  $("templateForm").reset();
}

function codeMatches(entry, query) {
  const text = [entry.title, entry.oj, entry.category, entry.tags, entry.note, entry.link].join(" ").toLowerCase();
  return text.includes(query);
}

function codeCardHtml(entry) {
  const meta = [entry.oj, entry.category, entry.tags, entry.date].filter(Boolean).join(" · ");
  const safeTitle = escapeHtml(entry.title) || "未命名代码";
  const title = entry.link
    ? `<a class="problem-link" href="${escapeHtml(entry.link)}" target="_blank" rel="noopener">${safeTitle}</a>`
    : safeTitle;
  return `
    <article class="lib-card">
      <div class="lib-card-head">
        <div>
          <h3>${title || "未命名代码"}</h3>
          ${meta ? `<div class="lib-meta">${escapeHtml(meta)}</div>` : ""}
        </div>
        <div class="lib-card-actions">
          <button class="icon-btn" type="button" data-code-action="copy" data-id="${escapeHtml(entry.id)}" title="复制代码">
            <i data-lucide="copy"></i>
          </button>
          <button class="icon-btn" type="button" data-code-action="edit" data-id="${escapeHtml(entry.id)}" title="编辑">
            <i data-lucide="pencil"></i>
          </button>
          <button class="icon-btn danger" type="button" data-code-action="delete" data-id="${escapeHtml(entry.id)}" title="删除">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
      ${entry.note ? `<p class="lib-note">${escapeHtml(entry.note)}</p>` : ""}
      <pre class="lib-code"><code>${escapeHtml(entry.code)}</code></pre>
    </article>
  `;
}

function renderCodeLib() {
  const query = $("codeSearch").value.trim().toLowerCase();
  const list = codeLib.filter((c) => !query || codeMatches(c, query));
  $("codeCount").textContent = codeLib.length;
  if (list.length === 0) {
    $("codeGrid").innerHTML = `<div class="empty-lib">代码库还是空的</div>`;
  } else {
    $("codeGrid").innerHTML = list.map(codeCardHtml).join("");
  }
  refreshIcons();
}

function openCodeForm(entry = null) {
  editingCodeId = entry ? entry.id : null;
  $("codeFormTitle").textContent = entry ? "编辑代码" : "添加代码";
  $("codeTitle").value = entry ? entry.title : "";
  $("codeOj").value = entry ? entry.oj : "";
  $("codeLink").value = entry ? entry.link : "";
  $("codeCategory").value = entry ? entry.category : "";
  $("codeTags").value = entry ? entry.tags : "";
  $("codeDate").value = entry ? entry.date : localDateString();
  $("codeNote").value = entry ? entry.note : "";
  $("codeBody").value = entry ? entry.code : "";
  $("codeFormPanel").hidden = false;
  $("codeFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  refreshIcons();
}

function closeCodeForm() {
  editingCodeId = null;
  $("codeFormPanel").hidden = true;
  $("codeForm").reset();
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

document.querySelectorAll(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

$("templateSearch").addEventListener("input", renderTemplates);
$("codeSearch").addEventListener("input", renderCodeLib);

$("addTemplateBtn").addEventListener("click", () => openTemplateForm());
$("cancelTemplateBtn").addEventListener("click", closeTemplateForm);

$("templateForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("templateTitle").value.trim();
  if (!title) {
    return;
  }
  const template = normalizeTemplate({
    id: editingTemplateId || undefined,
    title,
    category: $("templateCategory").value.trim(),
    tags: $("templateTags").value.trim(),
    note: $("templateNote").value.trim(),
    code: $("templateCode").value,
    updatedAt: Date.now()
  });
  const index = templates.findIndex((t) => t.id === editingTemplateId);
  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.unshift(template);
  }
  saveTemplates();
  closeTemplateForm();
  renderTemplates();
});

$("templateGrid").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-template-action]");
  if (!button) {
    return;
  }
  const template = templates.find((t) => t.id === button.dataset.id);
  if (!template) {
    return;
  }
  if (button.dataset.templateAction === "copy") {
    await copyToClipboard(template.code);
    button.title = "已复制";
    setTimeout(() => {
      button.title = "复制代码";
    }, 1200);
  } else if (button.dataset.templateAction === "edit") {
    openTemplateForm(template);
  } else if (button.dataset.templateAction === "delete") {
    if (window.confirm(`确认删除模板「${template.title}」？`)) {
      templates = templates.filter((t) => t.id !== template.id);
      saveTemplates();
      if (editingTemplateId === template.id) {
        closeTemplateForm();
      }
      renderTemplates();
    }
  }
});

$("addCodeBtn").addEventListener("click", () => openCodeForm());
$("cancelCodeBtn").addEventListener("click", closeCodeForm);

$("codeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("codeTitle").value.trim();
  if (!title) {
    return;
  }
  const entry = normalizeCodeEntry({
    id: editingCodeId || undefined,
    title,
    oj: $("codeOj").value.trim(),
    link: $("codeLink").value.trim(),
    category: $("codeCategory").value.trim(),
    tags: $("codeTags").value.trim(),
    date: $("codeDate").value,
    note: $("codeNote").value.trim(),
    code: $("codeBody").value
  });
  const index = codeLib.findIndex((c) => c.id === editingCodeId);
  if (index >= 0) {
    codeLib[index] = entry;
  } else {
    codeLib.unshift(entry);
  }
  saveCodeLib();
  closeCodeForm();
  renderCodeLib();
});

$("codeGrid").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-code-action]");
  if (!button) {
    return;
  }
  const entry = codeLib.find((c) => c.id === button.dataset.id);
  if (!entry) {
    return;
  }
  if (button.dataset.codeAction === "copy") {
    await copyToClipboard(entry.code);
    button.title = "已复制";
    setTimeout(() => {
      button.title = "复制代码";
    }, 1200);
  } else if (button.dataset.codeAction === "edit") {
    openCodeForm(entry);
  } else if (button.dataset.codeAction === "delete") {
    if (window.confirm(`确认删除代码「${entry.title}」？`)) {
      codeLib = codeLib.filter((c) => c.id !== entry.id);
      saveCodeLib();
      if (editingCodeId === entry.id) {
        closeCodeForm();
      }
      renderCodeLib();
    }
  }
});

$("exportBtn").addEventListener("click", () => {
  const payload = { version: 1, records, templates, codeLib };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `acm-backup-${localDateString()}.json`;
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
      if (Array.isArray(data)) {
        records = data
          .filter((r) => r && typeof r.date === "string" && Number.isFinite(Number(r.count)))
          .map(normalizeRecord);
        templates = [];
        codeLib = [];
      } else if (data && typeof data === "object") {
        records = Array.isArray(data.records)
          ? data.records
              .filter((r) => r && typeof r.date === "string" && Number.isFinite(Number(r.count)))
              .map(normalizeRecord)
          : [];
        templates = Array.isArray(data.templates) ? data.templates.map(normalizeTemplate) : [];
        codeLib = Array.isArray(data.codeLib) ? data.codeLib.map(normalizeCodeEntry) : [];
      } else {
        throw new Error("invalid file");
      }
      saveRecords();
      saveTemplates();
      saveCodeLib();
      resetForm();
      render();
      renderTemplates();
      renderCodeLib();
      window.alert(`导入成功：${records.length} 条打卡、${templates.length} 个模板、${codeLib.length} 条代码`);
    } catch (_) {
      window.alert("导入失败：请选择正确的 JSON 备份文件");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});

loadRecords();
loadTemplates();
loadCodeLib();
resetForm();
render();
renderTemplates();
renderCodeLib();
