"use strict";

(() => {
  const form = document.querySelector('#choice-form');
  const entry = document.querySelector('#new-choice');
  const list = document.querySelector('#choices-list');
  const feedback = document.querySelector('#choice-feedback');
  const sectors = document.querySelector('#wheel-sectors');
  const description = document.querySelector('#wheel-description');
  const status = document.querySelector('#wheel-status');
  const spinButton = document.querySelector('#spin-button');
  const result = document.querySelector('#wheel-result');
  const resultValue = document.querySelector('#result-value');
  const panel = document.querySelector('.choices-panel');
  const clearButton = document.querySelector('#clear-choices');
  const storageStatus = document.querySelector('#storage-status');
  const announcement = document.querySelector('#result-announcement');
  const storageKey = 'novytools.choice-wheel.choices.v1';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const choices = [];

  function saveChoices() {
    try {
      if (choices.length) window.localStorage.setItem(storageKey, JSON.stringify(choices.map(choice => choice.text)));
      else window.localStorage.removeItem(storageKey);
      storageStatus.textContent = 'Vos choix sont enregistrés automatiquement dans ce navigateur.';
    } catch {
      storageStatus.textContent = 'La sauvegarde est indisponible dans ce navigateur. Vos choix restent utilisables sur cette page.';
    }
  }

  clearButton.addEventListener('click', () => {
    if (spinning || !choices.length) return;
    choices.length = 0;
    list.replaceChildren();
    entry.value = '';
    updateWheel();
    saveChoices();
    feedback.textContent = 'La liste a été vidée.';
    entry.focus();
  });
  let spinning = false;
  let rotation = 0;

  function activeChoices() {
    return choices.filter(choice => choice.text.trim());
  }

  function lockChoices(locked) {
    panel.querySelectorAll('input, textarea, button').forEach(control => {
      control.disabled = locked;
    });
    panel.setAttribute('aria-busy', String(locked));
    spinButton.disabled = locked || activeChoices().length < 2;
    clearButton.disabled = locked || choices.length === 0;
  }

  function randomIndex(count) {
    // Rejection sampling gives each sector the same probability.
    const values = new Uint32Array(1);
    const ceiling = Math.floor(0x100000000 / count) * count;
    do { crypto.getRandomValues(values); } while (values[0] >= ceiling);
    return values[0] % count;
  }

  spinButton.addEventListener('click', () => {
    if (spinning) return;
    const active = activeChoices();
    if (active.length < 2) return;
    const winner = randomIndex(active.length);
    const targetAngle = (360 - winner * 360 / active.length) % 360;
    const startAngle = rotation;
    const travel = 5 * 360 + (targetAngle - startAngle + 360) % 360;
    spinning = true;
    lockChoices(true);
    result.hidden = true;
    resultValue.textContent = '';
    announcement.textContent = '';
    spinButton.textContent = 'La roue tourne…';
    status.textContent = 'Tirage en cours. Les choix sont verrouillés pendant la rotation.';

    function finish() {
      rotation = targetAngle;
      sectors.setAttribute('transform', `rotate(${rotation} 200 200)`);
      spinning = false;
      lockChoices(false);
      spinButton.textContent = 'Faire tourner';
      status.textContent = `${active.length} choix : vous pouvez relancer la roue.`;
      result.hidden = false;
      resultValue.textContent = active[winner].text.trim();
      announcement.textContent = `Résultat du tirage : ${active[winner].text.trim()}. Vous pouvez faire tourner la roue à nouveau.`;
      if (document.activeElement === document.body) spinButton.focus();
    }

    if (motionPreference.matches) {
      finish();
      return;
    }
    let startTime;
    function animate(timestamp) {
      if (motionPreference.matches) { finish(); return; }
      startTime ??= timestamp;
      const progress = Math.min(1, (timestamp - startTime) / 4500);
      const eased = 1 - Math.pow(1 - progress, 4);
      sectors.setAttribute('transform', `rotate(${startAngle + travel * eased} 200 200)`);
      if (progress < 1) window.requestAnimationFrame(animate);
      else finish();
    }
    window.requestAnimationFrame(animate);
  });
  function sectorColor(index, count) {
    // Spread hues around the circle without repeating a short palette.
    let step = Math.max(1, Math.floor(count * .382));
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    while (gcd(step, count) !== 1) step++;
    const hue = (42 + index * step * 360 / count) % 360;
    return `hsl(${hue} 58% 78%)`;
  }
  const ns = 'http://www.w3.org/2000/svg';
  let nextId = 0;

  function svg(tag, attributes, text) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function point(angle, radius = 180) {
    return [200 + radius * Math.cos(angle), 200 + radius * Math.sin(angle)];
  }

  function updateWheel() {
    // Blank edits are omitted immediately; the input stays available for correction.
    if (spinning) return;
    const active = activeChoices();
    rotation = 0;
    sectors.setAttribute('transform', 'rotate(0 200 200)');
    result.hidden = true;
    resultValue.textContent = '';
    announcement.textContent = '';
    spinButton.disabled = active.length < 2;
    clearButton.disabled = choices.length === 0;
    const count = active.length;
    sectors.replaceChildren();
    if (!count) sectors.append(svg('circle', { cx: 200, cy: 200, r: 180, fill: 'var(--color-surface-soft)' }));
    active.forEach((choice, index) => {
      const sweep = 2 * Math.PI / count;
      // The first sector is centered under the fixed pointer.
      const start = -Math.PI / 2 - sweep / 2 + index * sweep;
      const end = start + sweep;
      const attributes = count === 1
        ? { cx: 200, cy: 200, r: 180 }
        : { d: `M200 200 L${point(start).join(' ')} A180 180 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(end).join(' ')} Z` };
      const tag = count === 1 ? 'circle' : 'path';
      const shape = svg(tag, attributes);
      shape.setAttribute('fill', sectorColor(index, count));
      shape.setAttribute('stroke', 'var(--color-surface)');
      shape.setAttribute('stroke-width', '2');
      sectors.append(shape);

      const angle = (start + end) / 2;
      const degrees = angle * 180 / Math.PI;
      const [x, y] = point(angle, 110);
      // Radial labels use the length of the sector; flip the left half upright.
      const rotation = degrees + (Math.cos(angle) < -0.001 ? 180 : 0);
      const fontSize = Math.min(15, Math.max(6, 72 * Math.sin(Math.PI / Math.max(2, count))));
      const value = choice.text.trim();
      const label = svg('text', {
        x, y, transform: `rotate(${rotation} ${x} ${y})`,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: '#24483e', 'font-size': fontSize, 'font-weight': 750,
        'clip-path': `url(#choice-clip-${choice.id})`
      }, value);
      const clip = svg('clipPath', { id: `choice-clip-${choice.id}`, clipPathUnits: 'userSpaceOnUse' });
      // Counter-rotate the clipping shape to match the text's local coordinates.
      const clipShape = svg(tag, { ...attributes, transform: `rotate(${-rotation} ${x} ${y})` });
      clip.append(clipShape);
      sectors.append(clip, label);
      const chars = Array.from(value);
      const measure = () => label.getComputedTextLength?.() || Array.from(label.textContent).length * fontSize * .65;
      while (chars.length && measure() > 128) {
        chars.pop();
        label.textContent = chars.join('') + '…';
      }
      label.append(svg('title', {}, value));
    });
    description.textContent = count ? `Roue de ${count} choix à parts égales : ${active.map(c => c.text.trim()).join(', ')}` : 'Roue sans choix';
    document.querySelector('#empty-choices').hidden = choices.length > 0;
    status.textContent = count < 2
      ? `Ajoutez ${2 - count} choix ${count ? 'supplémentaire' : 'au minimum'} pour préparer un tirage.`
      : `${count} choix : votre roue est prête à tourner.`;
  }

  function appendChoice(text, render = true) {
    const choice = { id: nextId++, text };
    choices.push(choice);
    const row = document.createElement('li');
    const label = document.createElement('label');
    label.htmlFor = `choice-${choice.id}`;
    label.textContent = 'Modifier ce choix';
    const input = document.createElement('textarea');
    input.rows = 2;
    input.id = label.htmlFor;
    input.maxLength = 100;
    input.value = text;
    input.addEventListener('input', () => {
      if (spinning) return;
      choice.text = input.value;
      updateWheel();
      saveChoices();
    });
    input.addEventListener('blur', () => {
      if (spinning) return;
      choice.text = input.value.trim();
      input.value = choice.text;
      updateWheel();
      saveChoices();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button--quiet';
    remove.textContent = 'Supprimer';
    remove.addEventListener('click', () => {
      if (spinning) return;
      const index = choices.indexOf(choice);
      const target = row.nextElementSibling || row.previousElementSibling;
      choices.splice(index, 1);
      row.remove();
      updateWheel();
      saveChoices();
      feedback.textContent = 'Choix supprimé.';
      (target?.querySelector('textarea') || entry).focus();
    });
    row.append(label, input, remove);
    list.append(row);
    if (render) updateWheel();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (spinning) return;
    const value = entry.value.trim();
    if (!value) {
      entry.value = '';
      feedback.textContent = 'Saisissez un choix non vide.';
      entry.focus();
      return;
    }
    appendChoice(value);
    saveChoices();
    entry.value = '';
    feedback.textContent = 'Choix ajouté.';
    entry.focus();
  });
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const restored = JSON.parse(stored);
      if (!Array.isArray(restored) || !restored.every(value => typeof value === 'string')) throw new Error('Invalid choices');
      restored.map(value => value.trim().slice(0, 100)).filter(Boolean).forEach(value => appendChoice(value, false));
      if (choices.length) feedback.textContent = `${choices.length} choix retrouvés dans ce navigateur.`;
    }
  } catch {
    storageStatus.textContent = 'Les choix enregistrés ne peuvent pas être chargés. Vous pouvez créer une nouvelle liste.';
  }
  updateWheel();
})();
