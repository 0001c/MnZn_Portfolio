(function (root) {
  'use strict';
  const text = value => typeof value === 'string' && value.trim().length > 0;
  function mediaPath(value) {
    if (!text(value)) return false;
    if (/^https?:\/\//i.test(value)) return true;
    return !/^[a-z][a-z\d+.-]*:|^[/\\]|[?#]|(^|[/\\])\.\.([/\\]|$)/i.test(value);
  }
  function workLink(value) {
    if (!text(value) || /\s/.test(value) || !/^https?:\/\//i.test(value)) return false;
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; }
    catch { return false; }
  }
  function validate(data) {
    const errors = [];
    if (!data || typeof data !== 'object') return ['内容必须为 JSON 对象'];
    if (!text(data.profile?.name)) errors.push('profile.name：请填写姓名或站点名称');
    if (!text(data.profile?.role)) errors.push('profile.role：请填写身份');
    if (!Array.isArray(data.profile?.skills) || data.profile.skills.some(s => !text(s))) errors.push('profile.skills：技能必须为非空文字数组');
    if (data.profile?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.profile.email)) errors.push('profile.email：邮箱格式不正确');
    if (!Array.isArray(data.experience)) errors.push('experience：必须为数组');
    else data.experience.forEach((item, i) => {
      for (const field of ['period', 'organization', 'role', 'description']) if (!text(item[field])) errors.push(`experience[${i}].${field}：请填写内容`);
      if (!['published', 'draft'].includes(item.status)) errors.push(`experience[${i}].status：请选择 published 或 draft`);
    });
    const categories = new Set();
    if (!Array.isArray(data.categories) || !data.categories.length) errors.push('categories：至少保留一个分类');
    else data.categories.forEach((item, i) => {
      if (!text(item.id) || categories.has(item.id)) errors.push(`categories[${i}].id：分类标识不能为空或重复`);
      categories.add(item.id);
      if (!text(item.label) || !text(item.en)) errors.push(`categories[${i}]：请填写中英文名称`);
    });
    const slugs = new Set();
    if (!Array.isArray(data.projects)) errors.push('projects：必须为数组');
    else data.projects.forEach((item, i) => {
      const prefix = `projects[${i}]`;
      if (!text(item.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || slugs.has(item.slug)) errors.push(`${prefix}.slug：请填写唯一的英文小写短名称，用连字符分隔`);
      slugs.add(item.slug);
      for (const field of ['title', 'year', 'summary', 'description', 'alt']) if (!text(item[field])) errors.push(`${prefix}.${field}：请填写内容`);
      if (!categories.has(item.category)) errors.push(`${prefix}.category：分类不存在`);
      if (!mediaPath(item.cover)) errors.push(`${prefix}.cover：请填写站内相对路径或 http/https 地址`);
      if (!Array.isArray(item.images) || item.images.some(p => !mediaPath(p))) errors.push(`${prefix}.images：详情图片必须为有效路径数组`);
      if (item.links !== undefined) {
        if (!Array.isArray(item.links)) errors.push(`${prefix}.links：作品链接必须为数组`);
        else item.links.forEach((link, j) => { if (!workLink(link)) errors.push(`${prefix}.links[${j}]：第 ${j + 1} 行请填写完整的 http/https 网址`); });
      }
      if (!Number.isFinite(item.sortOrder)) errors.push(`${prefix}.sortOrder：必须为数字`);
      if (!['published', 'draft'].includes(item.status)) errors.push(`${prefix}.status：请选择 published 或 draft`);
    });
    return errors;
  }
  function publishedProjects(data) {
    return data.categories.flatMap(category => data.projects.filter(p => p.status === 'published' && p.category === category.id).sort((a, b) => a.sortOrder - b.sortOrder));
  }
  const api = { validate, publishedProjects, mediaPath, workLink };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PortfolioModel = api;
})(typeof window === 'object' ? window : globalThis);
