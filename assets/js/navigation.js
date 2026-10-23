import "./select.js?v=20260905";

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
         { id: "score", label: "Piste de score", path: "novytools/applications/piste-score/index.html" },
         { id: "choice-wheel", label: "La roue chanceuse", path: "novytools/applications/roue-de-choix/index.html" }
      ]
   },
   {
      title: "Informations",
      items: [
         { id: "about-games", label: "À propos de NovyLand Games", path: "jeux/about.html" },
         { id: "about-tools", label: "À propos de NovyTools", path: "novytools/about.html" },
         { id: "about-first-player", label: "À propos de Premier Joueur", path: "novytools/applications/premier-joueur/about.html" },
         { id: "about-timer", label: "À propos du Minuteur", path: "novytools/applications/minuteur/about.html" },
         { id: "about-score", label: "À propos de la Piste de score", path: "novytools/applications/piste-score/about.html" },
         { id: "about-choice-wheel", label: "À propos de La roue chanceuse", path: "novytools/applications/roue-de-choix/about.html" },
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
   const socialLinks = createElement("nav", {
      className: "novy-header__social",
      attributes: { "aria-label": "Réseaux sociaux de NovyLand Games" }
   });
   const facebook = createElement("a", {
      className: "novy-header__social-link",
      attributes: {
         href: "https://www.facebook.com/profile.php?id=61580253943876&locale=fr_CA",
         target: "_blank",
         rel: "noopener noreferrer",
         "aria-label": "NovyLand Games sur Facebook (nouvel onglet)",
         title: "Facebook"
      }
   });
   const facebookIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
   facebookIcon.setAttribute("viewBox", "0 0 24 24");
   facebookIcon.setAttribute("aria-hidden", "true");
   facebookIcon.setAttribute("focusable", "false");
   const facebookPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
   facebookPath.setAttribute("d", "M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.931-1.956 1.887v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z");
   facebookIcon.append(facebookPath);
   facebook.append(facebookIcon);
   socialLinks.append(facebook);
   const instagram = createElement("a", {
      className: "novy-header__social-link",
      attributes: {
         href: "https://www.instagram.com/novyland/",
         target: "_blank",
         rel: "noopener noreferrer",
         "aria-label": "NovyLand sur Instagram (nouvel onglet)",
         title: "Instagram"
      }
   });
   const instagramIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
   instagramIcon.setAttribute("viewBox", "0 0 24 24");
   instagramIcon.setAttribute("aria-hidden", "true");
   instagramIcon.setAttribute("focusable", "false");
   const instagramFrame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
   Object.entries({ x: "3", y: "3", width: "18", height: "18", rx: "5", fill: "none", stroke: "currentColor", "stroke-width": "2" }).forEach(([name, value]) => instagramFrame.setAttribute(name, value));
   const instagramLens = document.createElementNS("http://www.w3.org/2000/svg", "circle");
   Object.entries({ cx: "12", cy: "12", r: "4", fill: "none", stroke: "currentColor", "stroke-width": "2" }).forEach(([name, value]) => instagramLens.setAttribute(name, value));
   const instagramFlash = document.createElementNS("http://www.w3.org/2000/svg", "circle");
   Object.entries({ cx: "17.5", cy: "6.5", r: "1" }).forEach(([name, value]) => instagramFlash.setAttribute(name, value));
   instagramIcon.append(instagramFrame, instagramLens, instagramFlash);
   instagram.append(instagramIcon);
   socialLinks.append(instagram);
   header.append(socialLinks);

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
