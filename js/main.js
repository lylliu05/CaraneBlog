/**
 * 1) 根据 js/data.js（PROJECTS）与 js/recommend-data.js（RECOMMENDED）
 *    分别渲染「项目」与「推荐应用」两个版块的卡片
 * 2) "查看文档"：站内弹窗加载 *.md 并渲染，不跳转外部页面
 */
(function () {
  const grids = [
    {
      list: typeof PROJECTS !== "undefined" ? PROJECTS : [],
      el: document.getElementById("project-grid"),
      emptyText: "暂无项目，将安装包与文档放入 downloads/ 与 docs/ 即可自动展示。",
    },
    {
      list: typeof RECOMMENDED !== "undefined" ? RECOMMENDED : [],
      el: document.getElementById("recommend-grid"),
      emptyText: "暂无推荐应用，将安装包与文档放入 recommend/apps/ 与 recommend/docs/ 即可自动展示。",
    },
  ];

  const allApps = grids[0].list.concat(grids[1].list);

  const downloadIcon =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  const linkIcon =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  function buildActions(p) {
    // 主按钮：本地安装包优先；没有则用外部链接（recommend-meta.json 的 link 字段）
    const primary = p.downloadUrl
      ? '<a class="btn-download" href="' + p.downloadUrl + '" download>' + downloadIcon + "下载" + (p.version ? " " + p.version : p.fileSize ? " " + p.fileSize : "") + "</a>"
      : p.link
      ? '<a class="btn-download" href="' + p.link + '" target="_blank" rel="noopener">' + linkIcon + (p.linkLabel || "前往下载") + "</a>"
      : "";
    // 次按钮：文档弹窗；本地安装包与外链同时存在时，外链作为附加按钮
    const secondary =
      (p.docUrl ? '<button class="btn-secondary" type="button" data-doc="' + p.docUrl + '">查看文档</button>' : "") +
      (p.downloadUrl && p.link
        ? '<a class="btn-secondary" href="' + p.link + '" target="_blank" rel="noopener">' + (p.linkLabel || "官网链接") + "</a>"
        : "");
    return '<div class="card-actions">' + primary + secondary + "</div>";
  }

  function renderCards(list, grid, emptyText) {
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '<div class="empty-hint">' + emptyText + "</div>";
      return;
    }
    list.forEach(function (p, i) {
      const card = document.createElement("article");
      card.className = "project-card";
      card.style.animationDelay = i * 0.08 + "s";

      const tags = (p.tags || [])
        .map(function (t) {
          return '<span class="tag">' + t + "</span>";
        })
        .join("");

      const meta = [p.platform, p.version, p.fileSize, p.updateDate]
        .filter(Boolean)
        .join(" · ");

      card.innerHTML =
        '<div class="card-head">' +
        '  <span class="project-icon">' + (p.icon || "📦") + "</span>" +
        "  <div>" +
        '    <h3 class="card-title">' + p.name + "</h3>" +
        '    <div class="card-meta">' + meta + "</div>" +
        "  </div>" +
        "</div>" +
        '<p class="project-desc">' + (p.tagline ? "<strong>" + p.tagline + "</strong><br>" : "") + (p.description || "") + "</p>" +
        (tags ? '<div class="tag-list">' + tags + "</div>" : "") +
        buildActions(p);

      grid.appendChild(card);
    });
  }

  grids.forEach(function (g) {
    renderCards(g.list, g.el, g.emptyText);
  });

  // ---------- 文档弹窗 ----------
  const modal = document.getElementById("doc-modal");
  const content = document.getElementById("doc-content");
  const docTitle = document.getElementById("doc-title");
  const docCache = {};

  function openModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close") || e.target.closest("[data-close]")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  grids.forEach(function (g) {
    if (g.el) {
      g.el.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-doc]");
        if (!btn) return;
        openDoc(btn.getAttribute("data-doc"));
      });
    }
  });

  function openDoc(url) {
    const app = allApps.find(function (p) { return p.docUrl === url; });
    docTitle.textContent = app ? app.name : "文档";
    content.innerHTML = '<p class="doc-loading">正在加载文档…</p>';
    openModal();

    if (docCache[url]) {
      content.innerHTML = docCache[url];
      return;
    }

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      })
      .then(function (text) {
        const html = renderMarkdown(text);
        docCache[url] = html;
        content.innerHTML = html;
      })
      .catch(function () {
        content.innerHTML = '<p class="doc-loading">文档加载失败，请稍后重试。</p>';
      });
  }

  // ---------- 轻量 Markdown 渲染（标题/段落/列表/表格/代码块/引用/粗体/行内代码/链接） ----------
  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** 行内元素：`code`、**bold**、[text](url)（输入已转义） */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function renderMarkdown(text) {
    const lines = escapeHtml(text).split(/\r?\n/);
    const out = [];
    let para = [];
    let listType = null; // "ul" | "ol"
    let quote = [];
    let table = [];
    let inCode = false;
    let codeBuf = [];

    function flushPara() {
      if (para.length) {
        out.push("<p>" + inline(para.join(" ")) + "</p>");
        para = [];
      }
    }

    function flushList() {
      if (listType) {
        out.push("</" + listType + ">");
        listType = null;
      }
    }

    function flushQuote() {
      if (quote.length) {
        out.push("<blockquote>" + inline(quote.join(" ")) + "</blockquote>");
        quote = [];
      }
    }

    function flushTable() {
      if (!table.length) return;
      // 过滤 |---|---| 分隔行
      const rows = table.filter(function (r) {
        return !/^\s*\|?\s*:?-{2,}[\s:|-]*$/.test(r);
      });
      if (rows.length) {
        const parseRow = function (r) {
          return r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) {
            return c.trim();
          });
        };
        const head = parseRow(rows[0]);
        let html = "<table><thead><tr>" + head.map(function (h) { return "<th>" + inline(h) + "</th>"; }).join("") + "</tr></thead><tbody>";
        for (let r = 1; r < rows.length; r++) {
          html += "<tr>" + parseRow(rows[r]).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
        }
        html += "</tbody></table>";
        out.push(html);
      }
      table = [];
    }

    function flushAll() {
      flushPara();
      flushList();
      flushQuote();
      flushTable();
    }

    for (const line of lines) {
      // 代码块围栏
      if (/^```/.test(line.trim())) {
        if (inCode) {
          out.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>");
          codeBuf = [];
          inCode = false;
        } else {
          flushAll();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }

      const trimmed = line.trim();

      // 表格行
      if (/^\|.*\|/.test(trimmed)) {
        flushPara();
        flushList();
        flushQuote();
        table.push(trimmed);
        continue;
      }
      flushTable();

      // 空行
      if (trimmed === "") {
        flushPara();
        flushList();
        flushQuote();
        continue;
      }

      // 标题
      const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushAll();
        const level = h[1].length;
        out.push("<h" + level + ">" + inline(h[2]) + "</h" + level + ">");
        continue;
      }

      // 引用
      if (/^&gt;\s?/.test(trimmed)) {
        flushPara();
        flushList();
        quote.push(trimmed.replace(/^&gt;\s?/, ""));
        continue;
      }
      flushQuote();

      // 无序列表
      const ul = trimmed.match(/^[-*+]\s+(.*)$/);
      if (ul) {
        flushPara();
        if (listType !== "ul") {
          flushList();
          out.push("<ul>");
          listType = "ul";
        }
        out.push("<li>" + inline(ul[1]) + "</li>");
        continue;
      }

      // 有序列表
      const ol = trimmed.match(/^\d+[.、]\s+(.*)$/);
      if (ol) {
        flushPara();
        if (listType !== "ol") {
          flushList();
          out.push("<ol>");
          listType = "ol";
        }
        out.push("<li>" + inline(ol[1]) + "</li>");
        continue;
      }
      flushList();

      // 水平线
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        flushAll();
        out.push("<hr>");
        continue;
      }

      // 普通段落
      para.push(trimmed);
    }

    if (inCode && codeBuf.length) out.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>");
    flushAll();
    return out.join("\n");
  }
})();
