/** Shared single-selection control. Native selects remain the form/data source. */
const controls = new WeakMap();
let serial = 0;
let active = null;

export function refreshSelect(select) {
  controls.get(select)?.refresh();
}

export function focusSelect(select) {
  (controls.get(select)?.button || select).focus({ preventScroll: true });
}

export function enhanceSelects(root = document) {
  const selects = root.matches?.('select') ? [root] : root.querySelectorAll('select');
  selects.forEach((select) => {
    if (controls.has(select) || select.multiple || select.size > 1 || select.hidden) return;
    const id = `novy-select-${++serial}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'novy-select';
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `${id}-button`;
    button.className = 'novy-select__button';
    const value = document.createElement('span');
    value.id = `${id}-value`;
    button.append(value);
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', `${id}-options`);
    const list = document.createElement('div');
    list.id = `${id}-options`;
    list.className = 'novy-select__options';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    const labels = Array.from(select.labels || []);
    labels.forEach((label) => {
      label.id ||= `${id}-label-${labels.indexOf(label)}`;
      label.htmlFor = button.id;
    });
    const labelledBy = select.getAttribute('aria-labelledby') || labels.map(label => label.id).join(' ');
    const label = select.getAttribute('aria-label');
    if (label) {
      button.setAttribute('aria-label', label);
      list.setAttribute('aria-label', label);
    } else if (labelledBy) {
      button.setAttribute('aria-labelledby', labelledBy);
      list.setAttribute('aria-labelledby', labelledBy);
    }
    select.before(wrapper);
    wrapper.append(select, button, list);
    select.hidden = true;
    let options = [];
    let search = '';
    let lastKeyTime = 0;
    const disabled = option => option.disabled || option.parentElement?.disabled;
    const refresh = () => {
      value.textContent = select.selectedOptions[0]?.label || 'Choisir';
      button.disabled = select.matches(':disabled');
      button.setAttribute('aria-describedby', [select.getAttribute('aria-describedby'), value.id].filter(Boolean).join(' '));
      for (const attribute of ['aria-invalid']) {
        if (select.hasAttribute(attribute)) button.setAttribute(attribute, select.getAttribute(attribute));
        else button.removeAttribute(attribute);
      }
      list.setAttribute('aria-required', String(select.required));
      options = Array.from(select.options, (source, index) => {
        const option = document.createElement('div');
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(index === select.selectedIndex));
        option.setAttribute('aria-disabled', String(Boolean(disabled(source))));
        option.tabIndex = -1;
        option.dataset.index = String(index);
        option.textContent = source.label;
        return option;
      });
      list.replaceChildren(...options);
    };
    const close = (restore = false) => {
      list.hidden = true;
      wrapper.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      if (active?.select === select) active = null;
      if (restore && button.isConnected) button.focus({ preventScroll: true });
    };
    const focusOption = option => {
      if (!option) return;
      option.focus({ preventScroll: true });
      // Scroll only the popup, never move the page to focus a long list.
      list.scrollTop = Math.max(0, option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2);
    };
    const enabledOptions = () => options.filter(option => option.getAttribute('aria-disabled') !== 'true');
    const open = () => {
      if (button.disabled) return;
      active?.close();
      refresh();
      list.hidden = false;
      wrapper.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      active = { select, wrapper, close };
      search = '';
      focusOption(enabledOptions().find(option => option.getAttribute('aria-selected') === 'true') || enabledOptions()[0]);
    };
    const choose = option => {
      if (!option || option.getAttribute('aria-disabled') === 'true') return;
      const previous = select.selectedIndex;
      select.selectedIndex = Number(option.dataset.index);
      close(true);
      refresh();
      if (previous !== select.selectedIndex) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    button.addEventListener('click', () => list.hidden ? open() : close(true));
    button.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        open();
      }
    });
    list.addEventListener('click', event => choose(event.target.closest('[role="option"]')));
    list.addEventListener('keydown', event => {
      const enabled = enabledOptions();
      const index = enabled.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = enabled[Math.min(enabled.length - 1, index + 1)];
      else if (event.key === 'ArrowUp') next = enabled[Math.max(0, index - 1)];
      else if (event.key === 'Home') next = enabled[0];
      else if (event.key === 'End') next = enabled.at(-1);
      else if (['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(enabled[index]); return; }
      else if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      else if (event.key === 'Tab') { close(true); return; }
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const now = Date.now();
        search = now - lastKeyTime > 700 ? event.key : search + event.key;
        lastKeyTime = now;
        next = enabled.find(option => option.textContent.toLocaleLowerCase().startsWith(search.toLocaleLowerCase()));
      } else return;
      event.preventDefault();
      focusOption(next);
    });
    wrapper.addEventListener('focusout', event => {
      if (!wrapper.contains(event.relatedTarget)) close();
    });
    select.addEventListener('change', refresh);
    select.addEventListener('invalid', event => {
      event.preventDefault();
      button.setAttribute('aria-invalid', 'true');
      button.focus();
    });
    controls.set(select, { button, refresh });
    refresh();
  });
}

// One document listener/observer also covers controls added after page load.
document.addEventListener('pointerdown', event => {
  if (active && !active.wrapper.contains(event.target)) active.close();
});
document.addEventListener('reset', event => {
  setTimeout(() => event.target.querySelectorAll('select').forEach(refreshSelect), 0);
});
const observer = new MutationObserver(records => {
  for (const record of records) {
    const select = record.target.closest?.('select');
    if (select) refreshSelect(select);
    record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) enhanceSelects(node);
    });
  }
  if (active && !active.select.isConnected) active.close();
});
function initialize() {
  enhanceSelects();
  observer.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['disabled', 'selected', 'label', 'required', 'aria-invalid', 'aria-describedby'] });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
