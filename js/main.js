/**
 * 根据 js/data.js 中的 PROJECTS 配置渲染项目卡片
 */
(function () {
  const grid = document.getElementById("project-grid");
  if (!grid || typeof PROJECTS === "undefined") return;

  const downloadIcon =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  PROJECTS.forEach(function (p, i) {
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
      '<div class="card-actions">' +
      '  <a class="btn-download" href="' + p.downloadUrl + '" download>' + downloadIcon + "下载 " + (p.fileSize || "APK") + "</a>" +
      (p.docUrl ? '<a class="btn-secondary" href="' + p.docUrl + '" target="_blank" rel="noopener">查看文档</a>' : "") +
      "</div>";

    grid.appendChild(card);
  });
})();
