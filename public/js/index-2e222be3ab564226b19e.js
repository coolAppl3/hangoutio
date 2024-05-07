/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};

;// CONCATENATED MODULE: ./src/js/components/themeSwitcher.js
function themeSwitcher() {
  setTheme();
  var themeBtn = document.querySelector('#theme-switcher');
  themeBtn.addEventListener('click', changeTheme);
  themeBtn.addEventListener('keyup', handleThemeBtnKeyEvents);
}
;
function setTheme() {
  var darkTheme = JSON.parse(localStorage.getItem('darkTheme'));
  if (!darkTheme) {
    document.documentElement.classList.remove('dark');
    updateThemeBtn('light');
    return;
  }
  ;
  document.documentElement.classList.add('dark');
  updateThemeBtn('dark');
}
;
function handleThemeBtnKeyEvents(e) {
  if (e.key === 'Enter') {
    changeTheme();
  }
  ;
}
;
function changeTheme() {
  var darkTheme = JSON.parse(localStorage.getItem('darkTheme'));
  if (!darkTheme) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkTheme', true);
    updateThemeBtn('dark');
    return;
  }
  ;
  document.documentElement.classList.remove('dark');
  localStorage.removeItem('darkTheme', false);
  updateThemeBtn('light');
}
;
function updateThemeBtn(theme) {
  var themeBtn = document.querySelector('#theme-switcher');
  if (theme === 'dark') {
    themeBtn.classList.add('dark-theme');
    return;
  }
  ;
  themeBtn.classList.remove('dark-theme');
}
;
/* harmony default export */ const components_themeSwitcher = (themeSwitcher());
;// CONCATENATED MODULE: ./src/js/index.js


/******/ })()
;