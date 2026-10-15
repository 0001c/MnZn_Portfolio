'use strict';
(async () => {
  const get = id => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let data;
  try {
    const response = await fetch('content/portfolio.json');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    data = await response.json();
    const errors = PortfolioModel.validate(data);
    if (errors.length) throw new Error(errors.join('\n'));
  } catch (error) {
    get('profile-bio').textContent = '个人资料暂时无法读取，请稍后刷新。';
    get('work-preview').replaceChildren(el('p', 'content-message', '作品暂时无法读取，请稍后刷新。'));
    get('work-prev').disabled = get('work-next').disabled = true;
    get('work-flow').disabled = true;
    console.error('Portfolio content:', error);
    return;
  }
  document.querySelector('.logo').textContent = data.profile.name;
  document.querySelector('.logo').setAttribute('aria-label', `${data.profile.name}，回到首页`);
  document.querySelector('.identity').replaceChildren(document.createTextNode(data.profile.role), el('span', '', data.profile.tagline || ''));
  const siteTitle = data.profile.name + ' — Design with feeling';
  document.title = siteTitle;
  document.querySelector('meta[name="description"]').content = data.profile.bio || data.profile.tagline || '';
  get('profile-bio').textContent = data.profile.bio || '';
  get('bio-name').textContent = data.profile.name;
  get('bio-demo').hidden = !data.profile.demo;
  const experiences = data.experience.filter(item => item.status === 'published');
  const experienceNodes = [];
  for (const item of experiences) {
    const li = el('li');
    li.append(el('time', '', item.period), el('h3', '', item.organization), el('p', 'experience-role', item.role), el('p', 'experience-description', item.description));
    li.hidden = true;
    get('experience-list').append(li);
    experienceNodes.push(li);
  }
  if (!experiences.length) get('experience-list').append(el('li', 'content-message', '履历正在整理中。'));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const year = get('experience-year');
  const steps = el('div', 'experience-steps');
  steps.setAttribute('aria-hidden', 'true');
  const stepNodes = experiences.map(() => el('span'));
  steps.append(...stepNodes);
  get('experience-counter').before(steps);
  let experienceIndex = -1;
  function updateExperience() {
    const time = Number(document.body.dataset.storyTime || 0);
    const portion = Math.min(.999999, Math.max(0, (time - 3.5) / (6.7 - 3.5)));
    const index = Math.floor(portion * experiences.length);
    if (index === experienceIndex || !experiences.length) return;
    const previous = experienceIndex;
    const direction = index > previous ? 1 : -1;
    experienceIndex = index;
    experienceNodes.forEach((node, i) => { node.hidden = i !== index; node.classList.toggle('is-current', i === index); });
    stepNodes.forEach((node, i) => node.classList.toggle('is-current', i === index));
    const value = experiences[index].period.match(/\d{4}/)?.[0] || experiences[index].period;
    const oldValue = year.querySelector('.year-value')?.textContent;
    year.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    const current = el('span', 'year-value', value);
    year.replaceChildren(current);
    if (previous !== -1 && !motion.matches) {
      const options = { duration: 320, easing: 'cubic-bezier(.22, .7, .25, 1)' };
      if (oldValue) {
        const outgoing = el('span', 'year-value year-outgoing', oldValue);
        year.append(outgoing);
        const exit = outgoing.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-direction * 105}%)`, opacity: 0 }], options);
        exit.finished.catch(() => {}).then(() => outgoing.remove());
      }
      current.animate([{ transform: `translateY(${direction * 105}%)`, opacity: .15 }, { transform: 'translateY(0)', opacity: 1 }], options);
      const entry = experienceNodes[index];
      entry.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      for (const target of entry.querySelectorAll('time, h3')) {
        target.animate([{ transform: `translateY(${direction * 16}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], options);
      }
    }
    get('experience-counter').textContent = `${String(index + 1).padStart(2, '0')} / ${String(experiences.length).padStart(2, '0')} · 滚动查看履历 ↓`;
  }
  const storyObserver = new MutationObserver(updateExperience);
  storyObserver.observe(document.body, { attributes: true, attributeFilter: ['data-story-time'] });
  updateExperience();
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    year.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    year.querySelectorAll('.year-outgoing').forEach(node => node.remove());
    experienceNodes.forEach(node => node.getAnimations({ subtree: true }).forEach(animation => animation.cancel()));
  });
  get('skill-list').replaceChildren(...data.profile.skills.map(skill => el('span', '', skill)));
  if (data.profile.email) {
    get('profile-contact').href = 'mailto:' + data.profile.email;
    get('profile-contact').hidden = false;
  }
  const works = PortfolioModel.publishedProjects(data);
  const dialog = get('work-detail');
  const preview = get('work-preview');
  const chapter = document.querySelector('.chapter--works');
  let active = 0, selected = -1, previousHash = '', previousOverflow = '', focusOrigin = null;
  let phase = 0, cardWidth = 0, radiusX = 0, radiusY = 0, frame = 0, lastTime = 0, rotation = null;
  const fullTurn = Math.PI * 2;
  let manualPause = false, returning = false, returnTimer = 0, dialogAnimation = null, closing = false, restoringFocus = false;
  const buttons = new Map(), cards = [];
  get('works-demo').hidden = !works.some(p => p.demo);
  function image(path, alt) {
    const img = el('img'); img.src = path; img.alt = alt; img.decoding = 'async';
    img.addEventListener('error', () => img.replaceWith(el('div', 'image-fallback', '图片暂时无法显示')));
    return img;
  }
  const rail = el('div', 'work-rail');
  rail.setAttribute('role', 'group');
  rail.setAttribute('aria-label', '立体作品圆环，左右按钮旋转整个圆环，点击卡牌停驻，再次点击展开详情');
  preview.replaceChildren(rail);
  preview.dataset.state = 'flowing';
  const firstTiltDirection = Math.random() < .5 ? -1 : 1;
  const tiltDirections = works.map((_, index) => (index % 2 ? -1 : 1) * firstTiltDirection);
  // Randomize the directions without three matching neighbors, including the ring seam.
  if (works.length > 2) for (let index = 0; index < works.length; index++) {
    if (Math.random() < .5) continue;
    tiltDirections[index] *= -1;
    const directionAt = i => tiltDirections[(i + works.length) % works.length];
    if ([-2, -1, 0].some(delta => {
      const start = index + delta;
      return directionAt(start) === directionAt(start + 1) && directionAt(start) === directionAt(start + 2);
    })) tiltDirections[index] *= -1;
  }
  for (const [index, work] of works.entries()) {
    const category = data.categories.find(c => c.id === work.category);
    const slot = el('div', 'work-slot');
    const card = el('button', 'work-card');
    card.type = 'button'; card.dataset.slug = work.slug;
    card.setAttribute('aria-label', '停驻 ' + work.title + '，再次点击查看详情');
    card.setAttribute('aria-expanded', 'false');
    card.setAttribute('aria-controls', 'work-detail');
    card.append(image(work.cover, work.alt));
    const caption = el('span', 'work-caption'), title = el('span');
    title.append(el('small', '', `${category.en} / ${work.year}${work.demo ? ' / DEMO' : ''}`), el('strong', '', work.title));
    caption.append(title, el('span', 'work-summary', work.summary), el('span', 'view-work', '再次点击，展开案例 ↗'));
    card.append(caption);
    const gimbal = el('div', 'work-gimbal');
    gimbal.append(card); slot.append(gimbal); rail.append(slot);
    const tilt = tiltDirections[index] * (10 + Math.random() * 10);
    slot.style.setProperty('--tilt', tilt + 'deg');
    slot.style.setProperty('--pitch', (Math.random() * 20 - 10) + 'deg');
    const yaw = Math.random() * 24 - 12;
    slot.style.setProperty('--sway-time', (5 + Math.random() * 3) + 's');
    slot.style.setProperty('--sway-delay', (-Math.random() * 8) + 's');
    cards.push({ slot, card, gimbal, yaw, base: 0, spacing: .85 + Math.random() * .3 });
    const resetPointer = () => {
      gimbal.style.setProperty('--pointer-x', '0deg');
      gimbal.style.setProperty('--pointer-y', '0deg');
      card.style.removeProperty('--shine-x'); card.style.removeProperty('--shine-y');
    };
    card.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || motion.matches || dialog.open || returning) return;
      const rect = slot.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      const strength = selected === index ? 8 : 14;
      gimbal.style.setProperty('--pointer-x', (-y * strength) + 'deg');
      gimbal.style.setProperty('--pointer-y', (x * strength) + 'deg');
      card.style.setProperty('--shine-x', ((x + 1) * 50) + '%');
      card.style.setProperty('--shine-y', ((y + 1) * 50) + '%');
    });
    card.addEventListener('pointerleave', resetPointer);
    card.addEventListener('pointercancel', resetPointer);
    card.addEventListener('blur', resetPointer);
    card.addEventListener('click', () => {
      if (returning || closing) return;
      if (selected === index) openDetail();
      else selectCard(index);
    });
    card.addEventListener('focus', () => {
      if (card.matches(':focus-visible') && !dialog.open && !returning && !closing && !restoringFocus) selectCard(index);
    });
  }
  function syncControls() {
    const work = works[active];
    get('work-prev').disabled = get('work-next').disabled = !work;
    get('work-flow').disabled = !work;
    if (!work) {
      rail.replaceChildren(el('p', 'content-message', '作品正在整理中，敬请期待。'));
      return;
    }
    get('work-counter').textContent = `${String(active + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')} · ${work.title}`;
    get('work-hint').textContent = selected >= 0 ? '再次点击展开详情 · Esc 继续流动' : '点击停驻 · 再次点击展开';
    buttons.forEach((button, id) => button.setAttribute('aria-pressed', String(id === work.category)));
    const paused = selected >= 0 || manualPause;
    get('work-flow').textContent = paused ? '继续流动 ↗' : '暂停流动 Ⅱ';
    get('work-flow').setAttribute('aria-label', paused ? '继续作品流动' : '暂停作品流动');
    preview.dataset.state = selected >= 0 ? 'selected' : manualPause ? 'paused' : 'flowing';
    updateFlow();
  }
  function placeCards() {
    cards.forEach(({ slot, base, yaw }) => {
      const angle = base - phase, depth = Math.cos(angle);
      // A horizontal circle in perspective: the rear arc is smaller and higher.
      const scale = .8 / (1 - .2 * depth);
      slot.style.setProperty('--orbit-x', (Math.sin(angle) * radiusX * scale) + 'px');
      slot.style.setProperty('--orbit-y', (depth * radiusY * scale) + 'px');
      slot.style.setProperty('--orbit-scale', scale);
      slot.style.setProperty('--orbit-yaw', (yaw + Math.sin(angle) * 28) + 'deg');
      slot.style.setProperty('--orbit-opacity', .76 + .24 * (depth + 1) / 2);
      slot.style.setProperty('--stack', String(2 + Math.round((depth + 1) * 100)));
    });
  }
  function measure() {
    if (!cards.length) return;
    cardWidth = cards[0].slot.offsetWidth;
    const height = rail.clientHeight;
    radiusX = Math.max(0, (rail.clientWidth - cardWidth) / 2 - 18);
    radiusY = Math.max(8, Math.min(64, (height - cardWidth * 1.05) / 2 - 18));
    rail.style.setProperty('--selected-scale', Math.min(1.28, (rail.clientWidth - 36) / cardWidth, (height - 32) / Math.max(180, cardWidth / 1.45)));
    const total = cards.reduce((sum, item) => sum + item.spacing, 0);
    let angle = 0;
    cards.forEach(item => { item.base = angle; angle += item.spacing / total * fullTurn; });
    placeCards();
  }
  function visibleRing() {
    return !document.hidden && chapter.classList.contains('is-active') && !dialog.open;
  }
  function canFlow() {
    return works.length > 1 && selected < 0 && !manualPause && !returning && visibleRing() && !motion.matches;
  }
  function tick(now) {
    frame = 0;
    if (!visibleRing() || motion.matches || (!rotation && !canFlow())) { lastTime = 0; return; }
    const dt = lastTime ? Math.min(50, now - lastTime) : 0;
    lastTime = now;
    if (rotation) {
      rotation.elapsed += dt;
      const progress = Math.min(1, rotation.elapsed / 720);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      phase = rotation.from + (rotation.to - rotation.from) * eased;
      if (progress === 1) { rotation = null; phase %= fullTurn; }
    } else phase = (phase + dt * .00016) % fullTurn;
    placeCards(); updateFlow();
  }
  function updateFlow() {
    const running = canFlow() || !!rotation && visibleRing() && !motion.matches;
    preview.classList.toggle('is-running', running);
    if (!running) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    else if (!frame) frame = requestAnimationFrame(tick);
  }
  function rotateRing(direction) {
    if (works.length < 2 || closing || dialog.open) return;
    if (selected >= 0) releaseCard();
    const target = (rotation?.to ?? phase) - direction * fullTurn / works.length;
    if (motion.matches) { rotation = null; phase = target % fullTurn; placeCards(); }
    else rotation = { from: phase, to: target, elapsed: 0 };
    updateFlow();
  }
  function selectCard(index, animate = true) {
    if (!works.length) return;
    clearTimeout(returnTimer); returning = false; rotation = null;
    cards.forEach(({ slot, card }, i) => {
      slot.classList.toggle('is-selected', i === index);
      slot.classList.toggle('is-settling', animate);
      card.setAttribute('aria-expanded', String(i === index));
      cards[i].gimbal.style.setProperty('--pointer-x', '0deg');
      cards[i].gimbal.style.setProperty('--pointer-y', '0deg');
    });
    selected = active = index;
    preview.classList.add('has-selection');
    syncControls(); placeCards();
    returnTimer = setTimeout(() => cards.forEach(({ slot }) => slot.classList.remove('is-settling')), 650);
  }
  function releaseCard() {
    if (selected < 0) { syncControls(); return; }
    clearTimeout(returnTimer); returning = true;
    const item = cards[selected];
    item.slot.classList.add('is-settling');
    item.slot.classList.remove('is-selected');
    item.card.setAttribute('aria-expanded', 'false');
    selected = -1; preview.classList.remove('has-selection');
    placeCards(); syncControls();
    returnTimer = setTimeout(() => {
      cards.forEach(({ slot }) => slot.classList.remove('is-settling'));
      returning = false; updateFlow();
    }, motion.matches ? 0 : 650);
  }
  for (const category of data.categories) {
    const count = works.filter(work => work.category === category.id).length;
    if (!count) continue;
    const button = el('button', 'category-button', category.label);
    button.type = 'button'; button.append(el('small', '', String(count)));
    button.addEventListener('click', () => selectCard(works.findIndex(work => work.category === category.id)));
    buttons.set(category.id, button); get('work-categories').append(button);
  }
  function change(delta) {
    if (!works.length || closing) return;
    selectCard((active + delta + works.length) % works.length, !dialog.open);
    if (dialog.open) renderDetail();
  }
  function renderDetail() {
    const work = works[active], category = data.categories.find(c => c.id === work.category);
    focusOrigin = cards[active].card;
    get('detail-title').textContent = work.title;
    get('detail-category').textContent = `${category.en} / ${category.label}${work.demo ? ' · 演示项目' : ''}`;
    get('detail-summary').textContent = work.summary;
    get('detail-description').textContent = work.description;
    const links = (work.links || []).filter(PortfolioModel.workLink);
    get('detail-links').hidden = !links.length;
    get('detail-link-list').replaceChildren(...links.map(url => {
      const item = el('li'), link = el('a', '', url);
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', url + '（新标签页打开）'); item.append(link); return item;
    }));
    get('detail-meta').replaceChildren();
    for (const [key, value] of [['年份', work.year], ['负责', work.role], ['工具', work.tools]]) {
      if (value) get('detail-meta').append(el('dt', '', key), el('dd', '', value));
    }
    const paths = [work.cover, ...work.images], gallery = el('div', 'detail-images');
    get('detail-gallery').replaceChildren(el('p', 'note', paths.length > 1 ? '横向滑动查看更多 · 点击图片查看原尺寸 ↗' : '点击图片查看原尺寸 ↗'), gallery);
    for (const [i, path] of paths.entries()) {
      const link = el('a'); link.href = path; link.target = '_blank'; link.rel = 'noopener';
      link.append(image(path, i ? `${work.title} · 详情 ${i}` : work.alt)); gallery.append(link);
    }
    get('detail-counter').textContent = `${active + 1} / ${works.length}`;
    get('detail-prev').disabled = active === 0; get('detail-next').disabled = active === works.length - 1;
    history.replaceState(null, '', '#work/' + work.slug);
    document.title = work.title + ' — ' + data.profile.name;
    get('detail-copy').scrollTop = 0;
  }
  function detailTransform() {
    const card = cards[active]?.card;
    if (!card) return 'none';
    const source = card.getBoundingClientRect(), target = dialog.getBoundingClientRect();
    if (!target.width || !target.height) return 'none';
    return `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width}, ${source.height / target.height})`;
  }
  function openDetail() {
    if (!works.length || dialog.open) return;
    previousHash = location.hash.startsWith('#work/') ? '#chapter-3' : location.hash;
    previousOverflow = document.documentElement.style.overflow;
    focusOrigin = cards[active].card;
    document.documentElement.style.overflow = 'hidden';
    renderDetail(); dialog.showModal(); updateFlow();
    dialog.classList.remove('is-closing');
    if (!motion.matches) {
      dialogAnimation = dialog.animate([
        { transform: detailTransform(), opacity: .55, borderRadius: '18px' },
        { transform: 'none', opacity: 1, borderRadius: '32px' }
      ], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  function closeDetail() {
    if (!dialog.open || closing) return;
    closing = true;
    dialogAnimation?.cancel();
    dialog.classList.add('is-closing');
    if (motion.matches) { dialog.close(); return; }
    dialogAnimation = dialog.animate([
      { transform: 'none', opacity: 1, borderRadius: '32px' },
      { transform: detailTransform(), opacity: .35, borderRadius: '18px' }
    ], { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    dialogAnimation.finished.then(() => dialog.close()).catch(() => {});
  }
  dialog.addEventListener('close', () => {
    dialogAnimation?.cancel(); dialogAnimation = null; closing = false;
    dialog.classList.remove('is-closing');
    document.documentElement.style.overflow = previousOverflow;
    history.replaceState(null, '', location.pathname + location.search + previousHash);
    document.title = siteTitle;
    if (!focusOrigin?.isConnected) focusOrigin = cards[active]?.card;
    restoringFocus = true;
    focusOrigin?.focus({ preventScroll: true });
    restoringFocus = false;
    manualPause = false;
    releaseCard();
  });
  dialog.querySelector('.detail-close').addEventListener('click', closeDetail);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDetail();
  });
  dialog.addEventListener('keydown', event => {
    if (!closing && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); change(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  get('work-prev').addEventListener('click', () => rotateRing(-1));
  get('work-next').addEventListener('click', () => rotateRing(1));
  get('detail-prev').addEventListener('click', () => change(-1));
  get('detail-next').addEventListener('click', () => change(1));
  get('work-flow').addEventListener('click', () => {
    if (selected >= 0) { manualPause = false; releaseCard(); }
    else { manualPause = !manualPause; if (manualPause) rotation = null; syncControls(); }
  });
  preview.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); rotateRing(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.open && selected >= 0) { manualPause = false; releaseCard(); }
  });
  preview.addEventListener('click', event => {
    if (event.target === rail || event.target === preview) { manualPause = false; releaseCard(); }
  });
  new ResizeObserver(measure).observe(rail);
  new MutationObserver(() => {
    if (!chapter.classList.contains('is-active') && !dialog.open && selected >= 0) releaseCard();
    updateFlow();
  }).observe(chapter, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', updateFlow);
  motion.addEventListener('change', () => {
    if (motion.matches) {
      if (rotation) { phase = rotation.to % fullTurn; rotation = null; placeCards(); }
      cards.forEach(({ gimbal }) => { gimbal.style.setProperty('--pointer-x', '0deg'); gimbal.style.setProperty('--pointer-y', '0deg'); });
    }
    if (motion.matches && dialogAnimation) {
      dialogAnimation.cancel();
      if (closing) dialog.close();
    }
    updateFlow();
  });
  measure(); syncControls();
  function showLinkedWork() {
    const slug = location.hash.startsWith('#work/') ? location.hash.slice(6) : '';
    const index = works.findIndex(work => work.slug === slug);
    if (index < 0) return;
    selectCard(index, false);
    if (dialog.open) renderDetail();
    else { document.querySelector('.nav a[data-jump="6.7"]').click(); openDetail(); }
  }
  window.addEventListener('hashchange', showLinkedWork);
  showLinkedWork();
})();
