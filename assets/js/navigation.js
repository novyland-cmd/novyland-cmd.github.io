"use strict";

const NAVIGATION_SECTIONS = [
   {
      title: "Navigation",
      items: [
         { id: "novyland-home", label: "Accueil NovyLand", path: "index.html" },
         { id: "novytools-home", label: "Accueil NovyTools", path: "novytools/index.html", contexts: ["novytools"] },
         { id: "games", label: "Jeux", path: "jeux/index.html" },
         { id: "novytools", label: "NovyTools", path: "novytools/index.html", hideWhenContext: "novytools" }
      ]
   },
   {
      title: "Applications",
      items: [
         { id: "first-player", label: "Premier Joueur", path: "novytools/applications/premier-joueur/index.html" },
         { id: "timer", label: "Minuteur de jeu", path: "novytools/applications/minuteur/index.html" },
         { id: "score", label: "Compteur de points · Bientôt", disabled: true }
      ]
   },
   {
      title: "Informations",
      items: [
         { id: "about-games", label: "À propos de NovyLand Games", path: "jeux/about.html" },
         { id: "about-tools", label: "À propos de NovyTools", path: "novytools/about.html" },
         { id: "about-first-player", label: "À propos de Premier Joueur", path: "novytools/applications/premier-joueur/about.html" },
         { id: "about-timer", label: "À propos du Minuteur", path: "novytools/applications/minuteur/about.html" },
         { id: "privacy", label: "Politique de confidentialité", path: "pages/privacy.html" },
         { id: "legal", label: "Mentions légales", path: "pages/legal.html" }
      ]
   }
];

const FOCUSABLE_SELECTOR = [
   "a[href]",
   "button:not([disabled])",
   "[tabindex]:not([tabindex='-1'])"
].join(",");

function getSiteRoot() {
   return new URL("../../", import.meta.url);
}

function resolveDestination(path) {
   return new URL(path, getSiteRoot()).href;
}

function createElement(tagName, options = {}) {
   const element = document.createElement(tagName);
   if (options.className) element.className = options.className;
   if (options.text) element.textContent = options.text;
   if (options.attributes) {
      Object.entries(options.attributes).forEach(([name, value]) => {
         element.setAttribute(name, value);
      });
   }
   return element;
}

function shouldDisplayItem(item, context) {
   if (item.contexts && !item.contexts.includes(context)) return false;
   if (item.hideWhenContext === context) return false;
   return true;
}

function buildMenuNavigation(pageId, context) {
   const navigation = createElement("nav", {
      className: "novy-nav__links",
      attributes: { "aria-label": "Navigation du site" }
   });

   NAVIGATION_SECTIONS.forEach((section) => {
      const visibleItems = section.items.filter((item) => shouldDisplayItem(item, context));
      if (!visibleItems.length) return;

      const group = createElement("section", { className: "novy-nav__group" });
      group.append(createElement("h2", { className: "novy-nav__group-title", text: section.title }));

      visibleItems.forEach((item) => {
         if (item.disabled) {
            group.append(createElement("span", {
               className: "novy-nav__disabled",
               text: item.label,
               attributes: { "aria-disabled": "true" }
            }));
            return;
         }

         const link = createElement("a", {
            className: "novy-nav__link",
            text: item.label,
            attributes: { href: resolveDestination(item.path) }
         });

         if (item.id === pageId) link.setAttribute("aria-current", "page");
         group.append(link);
      });

      navigation.append(group);
   });

   return navigation;
}

function buildNavigation(mount) {
   const pageId = mount.dataset.page || "";
   const context = mount.dataset.context || "novyland";
   const brandTitle = mount.dataset.brand || "NovyLand";
   const brandSubtitle = mount.dataset.subtitle || "Jeux de société et outils ludiques";

   const header = createElement("header", { className: "novy-header" });
   const toggle = createElement("button", {
      className: "novy-nav__toggle",
      text: "☰",
      attributes: {
         type: "button",
         "aria-label": "Ouvrir le menu principal",
         "aria-expanded": "false",
         "aria-controls": "novy-navigation-panel"
      }
   });

   const brand = createElement("a", {
      className: "novy-header__brand",
      attributes: { href: resolveDestination("index.html"), "aria-label": "Accueil principal de NovyLand" }
   });
   const logo = createElement("img", {
      className: "novy-header__logo",
      attributes: {
         src: resolveDestination("images/meeple.png"),
         alt: "",
         width: "40",
         height: "40",
         "aria-hidden": "true"
      }
   });
   brand.append(logo);
   const copy = createElement("span", { className: "novy-header__copy" });
   copy.append(createElement("strong", { text: brandTitle }));
   copy.append(createElement("span", { text: brandSubtitle }));
   brand.append(copy);
   header.append(toggle, brand);

   const overlay = createElement("div", { className: "novy-nav__overlay", attributes: { hidden: "" } });
   const panel = createElement("aside", {
      className: "novy-nav__panel",
      attributes: { id: "novy-navigation-panel", hidden: "", tabindex: "-1", "aria-label": "Menu principal" }
   });
   const panelHeader = createElement("div", { className: "novy-nav__head" });
   panelHeader.append(createElement("strong", { text: "NovyLand" }));
   const closeButton = createElement("button", {
      className: "novy-nav__close",
      text: "×",
      attributes: { type: "button", "aria-label": "Fermer le menu principal" }
   });
   panelHeader.append(closeButton);
   panel.append(panelHeader, buildMenuNavigation(pageId, context));

   mount.replaceChildren(header, overlay, panel);
   return { toggle, closeButton, overlay, panel };
}

function initializeNavigation(mount) {
   const { toggle, closeButton, overlay, panel } = buildNavigation(mount);
   let previouslyFocused = null;
   let scrollPosition = 0;
   let closingTimer = 0;

   function lockPageScroll() {
      scrollPosition = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollPosition}px`;
      document.body.style.width = "100%";
      document.body.classList.add("novy-nav-open");
   }

   function unlockPageScroll() {
      document.body.classList.remove("novy-nav-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollPosition);
   }

   function openMenu() {
      window.clearTimeout(closingTimer);
      previouslyFocused = document.activeElement;
      panel.hidden = false;
      overlay.hidden = false;
      lockPageScroll();

      requestAnimationFrame(() => {
         panel.classList.add("is-open");
         overlay.classList.add("is-open");
      });

      toggle.setAttribute("aria-expanded", "true");
      closeButton.focus();
   }

   function closeMenu({ restoreFocus = true } = {}) {
      if (toggle.getAttribute("aria-expanded") !== "true") return;

      panel.classList.remove("is-open");
      overlay.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      unlockPageScroll();

      closingTimer = window.setTimeout(() => {
         panel.hidden = true;
         overlay.hidden = true;
      }, 230);

      if (restoreFocus) (previouslyFocused || toggle).focus();
   }

   function trapFocus(event) {
      if (event.key !== "Tab" || toggle.getAttribute("aria-expanded") !== "true") return;
      const focusableItems = [...panel.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusableItems.length) return;

      const first = focusableItems[0];
      const last = focusableItems[focusableItems.length - 1];
      if (event.shiftKey && document.activeElement === first) {
         event.preventDefault();
         last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
         event.preventDefault();
         first.focus();
      }
   }

   toggle.addEventListener("click", () => {
      if (toggle.getAttribute("aria-expanded") === "true") closeMenu();
      else openMenu();
   });
   closeButton.addEventListener("click", () => closeMenu());
   overlay.addEventListener("click", () => closeMenu());
   panel.addEventListener("click", (event) => {
      if (event.target.closest("a[href]")) closeMenu({ restoreFocus: false });
   });
   document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
      else trapFocus(event);
   });
}

const navigationMount = document.querySelector("[data-site-navigation]");
if (navigationMount) initializeNavigation(navigationMount);
