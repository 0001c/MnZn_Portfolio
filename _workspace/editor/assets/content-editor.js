'use strict';
(async () => {
  const get = id => document.getElementById(id);
  let data, handle = null, dirty = false;
  let expanded = new WeakSet();
  const setStatus = text => { get('editor-status').textContent = text; };
  const showError = text => { get('editor-error').textContent = text; get('editor-error').hidden = !text; };
  const changed = () => { dirty = true; setStatus('尚未保存'); };
  function node(tag, className, text) {
    const n = document.createElement(tag); if (className) n.className = className;
    if (text !== undefined) n.textContent = text; return n;
  }
  function field(container, object, key, label, kind = 'text', wide = false, options = []) {
    const wrapper = node('label', 'field' + (wide ? ' wide' : '') + (kind === 'checkbox' ? ' check' : ''));
    const input = node(kind === 'textarea' || kind === 'lines' || kind === 'skills' ? 'textarea' : kind === 'select' ? 'select' : 'input');
    if (input.tagName === 'INPUT') input.type = kind;
    if (kind === 'select') for (const [value, title] of options) { const option = node('option', '', title); option.value = value; input.append(option); }
    input.name = key; input.setAttribute('aria-label', label);
    if (kind === 'checkbox') input.checked = Boolean(object[key]);
    else input.value = kind === 'lines' ? (object[key] || []).join('\n') : kind === 'skills' ? (object[key] || []).join('、') : object[key] ?? '';
    input.addEventListener('input', () => {
      object[key] = kind === 'checkbox' ? input.checked : kind === 'number' ? Number(input.value) : kind === 'lines' ? input.value.split('\n').map(s => s.trim()).filter(Boolean) : kind === 'skills' ? input.value.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean) : input.value;
      changed();
    });
    wrapper.append(node('span', '', label), input); container.append(wrapper); return input;
  }
  function action(container, label, fn, danger = false) {
    const button = node('button', 'small-button' + (danger ? ' danger' : ''), label); button.type = 'button'; button.addEventListener('click', fn); container.append(button);
  }
  function entries(key) {
    const list = get(key === 'projects' ? 'project-fields' : 'experience-fields'); list.replaceChildren();
    data[key].forEach((item, index) => {
      const entry = node('div', 'entry'), head = node('div', 'entry-head'), actions = node('div', 'entry-actions'), grid = node('div', 'field-grid');
      const heading = node('h3'), toggle = node('button', 'entry-toggle'), title = node('span', 'entry-title');
      const state = node('span', 'entry-toggle-state'), chevron = node('span', 'entry-chevron');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 16 16'); icon.setAttribute('focusable', 'false');
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      arrow.setAttribute('points', '4 6 8 10 12 6'); icon.append(arrow); chevron.append(icon);
      chevron.setAttribute('aria-hidden', 'true'); toggle.type = 'button';
      const panel = node('div', 'entry-panel'), body = node('div', 'entry-body'), content = node('div', 'entry-content');
      panel.id = `${key}-panel-${index}`; toggle.setAttribute('aria-controls', panel.id);
      const updateTitle = () => { title.textContent = `${String(index + 1).padStart(2, '0')} / ${key === 'projects' ? item.title || '新作品' : item.organization || '新经历'}`; };
      const updateExpanded = () => {
        const open = expanded.has(item);
        entry.classList.toggle('is-expanded', open); toggle.setAttribute('aria-expanded', String(open));
        state.textContent = open ? '收起' : '展开'; panel.inert = !open; panel.setAttribute('aria-hidden', String(!open));
      };
      toggle.addEventListener('click', () => { if (expanded.has(item)) expanded.delete(item); else expanded.add(item); updateExpanded(); });
      grid.addEventListener('input', updateTitle);
      updateTitle(); updateExpanded(); toggle.append(title, state, chevron); heading.append(toggle); head.append(heading, actions);
      if (key === 'experience') {
        for (const [title, delta] of [['上移', -1], ['下移', 1]]) action(actions, title, () => { const next = index + delta; if (next < 0 || next >= data[key].length) return; [data[key][index], data[key][next]] = [data[key][next], data[key][index]]; changed(); entries(key); });
      } else action(actions, '复制', () => { const copy = structuredClone(item); let suffix = 2; while (data.projects.some(p => p.slug === item.slug + '-' + suffix)) suffix++; copy.slug = item.slug + '-' + suffix; copy.title = item.title + ' · 副本'; copy.status = 'draft'; expanded.add(copy); data.projects.splice(index + 1, 0, copy); changed(); entries(key); });
      action(actions, '删除', () => { if (confirm('删除这条内容？保存文件后生效。')) { data[key].splice(index, 1); changed(); entries(key); } }, true);
      if (key === 'experience') {
        field(grid, item, 'period', '年份区间'); field(grid, item, 'organization', '学校 / 公司 / 客户'); field(grid, item, 'role', '专业 / 职位'); field(grid, item, 'status', '状态', 'select', false, [['published', '已发布'], ['draft', '草稿']]); field(grid, item, 'description', '经历描述', 'textarea', true);
      } else {
        field(grid, item, 'title', '作品名称'); field(grid, item, 'slug', '唯一标识（例如 coffee-brand）'); field(grid, item, 'year', '年份'); field(grid, item, 'category', '分类', 'select', false, data.categories.map(c => [c.id, c.label])); field(grid, item, 'summary', '一句话简介', 'text', true); field(grid, item, 'description', '详情（背景、职责、设计过程、结果）', 'textarea', true);
        const cover = field(grid, item, 'cover', '封面图片路径', 'text', true);
        const links = field(grid, item, 'links', '作品链接（每行一个，可留空）', 'lines', true);
        links.placeholder = 'https://example.com/project\nhttps://example.com/prototype'; links.spellcheck = false;
        field(grid, item, 'alt', '封面图片说明'); field(grid, item, 'sortOrder', '同类排序数字', 'number'); field(grid, item, 'role', '你负责的部分'); field(grid, item, 'tools', '使用工具'); field(grid, item, 'images', '详情图片路径（每行一张）', 'lines', true); field(grid, item, 'status', '状态', 'select', false, [['published', '已发布'], ['draft', '草稿']]); field(grid, item, 'demo', '这是演示作品', 'checkbox');
        const preview = node('img', 'cover-preview'); preview.alt = '封面预览';
        const updatePreview = () => { preview.hidden = !PortfolioModel.mediaPath(item.cover); if (!preview.hidden) preview.src = new URL(item.cover, new URL('../../', location.href)).href; };
        preview.addEventListener('error', () => { preview.hidden = true; }); cover.addEventListener('change', updatePreview); updatePreview(); content.append(preview);
      }
      content.prepend(grid); body.append(content); panel.append(body); entry.append(head, panel); list.append(entry);
    });
  }
  function render() {
    const grid = get('profile-fields'); grid.replaceChildren();
    field(grid, data.profile, 'name', '姓名 / Logo'); field(grid, data.profile, 'role', '身份（首页右上角）'); field(grid, data.profile, 'tagline', '个人标语', 'text', true); field(grid, data.profile, 'bio', '个人简介', 'textarea', true); field(grid, data.profile, 'skills', '专业能力（顿号或逗号分隔）', 'skills', true); field(grid, data.profile, 'email', '联系邮箱（可留空）', 'email'); field(grid, data.profile, 'demo', '个人资料和履历为演示内容', 'checkbox'); entries('experience'); entries('projects');
  }
  function useData(value) {
    const errors = PortfolioModel.validate(value); if (errors.length) throw new Error(errors.join('\n'));
    data = value; expanded = new WeakSet(); render(); dirty = false; showError(''); get('save-file').disabled = get('download-file').disabled = false; setStatus('内容已载入');
  }
  function serialized() {
    const errors = PortfolioModel.validate(data);
    if (errors.length) { showError(errors.join('\n')); get('editor-error').scrollIntoView({ block: 'center' }); return null; }
    showError(''); return JSON.stringify(data, null, 2) + '\n';
  }
  function download() {
    const text = serialized(); if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = 'portfolio.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('已下载；请替换 content/portfolio.json');
  }
  get('download-file').addEventListener('click', download);
  get('save-file').addEventListener('click', async () => {
    const text = serialized(); if (!text) return;
    if (!window.showSaveFilePicker) { download(); return; }
    try {
      if (!handle) handle = await showSaveFilePicker({ suggestedName: 'portfolio.json', types: [{ description: '作品集内容 JSON', accept: { 'application/json': ['.json'] } }] });
      const stream = await handle.createWritable(); await stream.write(text); await stream.close(); dirty = false; setStatus('已保存 ' + handle.name + '；刷新网站查看');
    } catch (error) { if (error.name !== 'AbortError') showError('保存失败：' + error.message + '\n也可以下载 JSON 后替换内容文件。'); }
  });
  get('open-file').addEventListener('click', async () => {
    if (dirty && !confirm('打开文件会替换尚未保存的编辑，是否继续？')) return;
    if (!window.showOpenFilePicker) { get('import-file').click(); return; }
    try { const [picked] = await showOpenFilePicker({ types: [{ description: '作品集内容 JSON', accept: { 'application/json': ['.json'] } }], multiple: false }); const file = await picked.getFile(); useData(JSON.parse(await file.text())); handle = picked; setStatus('已打开 ' + file.name); }
    catch (error) { if (error.name !== 'AbortError') showError('无法打开：' + error.message); }
  });
  get('import-file').addEventListener('change', async event => {
    try { const file = event.target.files[0]; if (file) { useData(JSON.parse(await file.text())); handle = null; } } catch (error) { showError('无法导入：' + error.message); } event.target.value = '';
  });
  function revealNew(key, item) {
    data[key].push(item); expanded.add(item); changed(); entries(key);
    const list = get(key === 'projects' ? 'project-fields' : 'experience-fields');
    list.lastElementChild.querySelector('.entry-toggle').focus();
  }
  get('add-experience').addEventListener('click', () => { if (!data) return; revealNew('experience', { period: '', organization: '', role: '', description: '', status: 'draft' }); });
  get('add-project').addEventListener('click', () => {
    if (!data) return;
    revealNew('projects', { slug: '', title: '', year: String(new Date().getFullYear()), category: data.categories[0].id, summary: '', description: '', cover: '', alt: '', images: [], links: [], role: '', tools: '', sortOrder: (data.projects.length + 1) * 10, status: 'draft', demo: false });
  });
  get('editor-form').addEventListener('submit', event => event.preventDefault());
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  try { const response = await fetch('../../content/portfolio.json', { cache: 'no-store' }); if (!response.ok) throw new Error('HTTP ' + response.status); useData(await response.json()); }
  catch (error) { showError('读取失败：' + error.message + '\n请通过本地 HTTP 地址打开本页，或选择现有 JSON 文件。'); setStatus('等待打开文件'); get('save-file').disabled = get('download-file').disabled = true; }
})();
