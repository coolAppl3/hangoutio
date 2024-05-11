/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};

;// CONCATENATED MODULE: ./src/ts/components/global/themeSwitcher.ts
function themeSwitcher() {
    setTheme();
    const themeBtn = document.querySelector('#theme-switcher');
    themeBtn === null || themeBtn === void 0 ? void 0 : themeBtn.addEventListener('click', changeTheme);
    themeBtn === null || themeBtn === void 0 ? void 0 : themeBtn.addEventListener('keyup', handleThemeBtnKeyEvents);
}
;
function setTheme() {
    const darkThemeItem = localStorage.getItem('darkTheme');
    const darkTheme = darkThemeItem ? JSON.parse(darkThemeItem) : null;
    if (!darkTheme) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkTheme', JSON.stringify(false));
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
    const darkThemeItem = localStorage.getItem('darkTheme');
    const darkTheme = darkThemeItem ? JSON.parse(darkThemeItem) : null;
    if (!darkTheme) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkTheme', JSON.stringify(true));
        updateThemeBtn('dark');
        return;
    }
    ;
    document.documentElement.classList.remove('dark');
    localStorage.setItem('darkTheme', JSON.stringify(false));
    updateThemeBtn('light');
}
;
function updateThemeBtn(theme) {
    const themeBtn = document.querySelector('#theme-switcher');
    if (theme === 'dark') {
        themeBtn === null || themeBtn === void 0 ? void 0 : themeBtn.classList.add('dark-theme');
        return;
    }
    ;
    themeBtn === null || themeBtn === void 0 ? void 0 : themeBtn.classList.remove('dark-theme');
}
;

;// CONCATENATED MODULE: ./src/ts/components/global/Cookies.ts
class Cookies {
    static get(cookieName) {
        const cookieMap = this.createCookieMap();
        const cookie = cookieMap.get(cookieName);
        if (!cookie) {
            return;
        }
        ;
        return cookie;
    }
    ;
    static set(cookieName, cookieValue, maxAgeInSeconds) {
        if (this.isEmptyString(cookieName) || this.isEmptyString(cookieValue)) {
            return;
        }
        ;
        if (!maxAgeInSeconds) {
            document.cookie = `${cookieName}=${cookieValue}; path=/; Secure`;
            return;
        }
        ;
        document.cookie = `${cookieName}=${cookieValue}; max-age=${maxAgeInSeconds}; path=/; Secure`;
    }
    ;
    static remove(cookieName) {
        if (this.isEmptyString(cookieName)) {
            return;
        }
        ;
        document.cookie = `${cookieName}=; max-age=0`;
    }
    ;
    static createCookieMap() {
        const cookies = document.cookie;
        const cookieMap = new Map();
        if (!cookies) {
            return cookieMap;
        }
        ;
        const cookiesArray = cookies.split('; ');
        for (const cookie of cookiesArray) {
            const mapKey = cookie.split('=')[0];
            const mapValue = cookie.split('=')[1];
            cookieMap.set(mapKey, mapValue);
        }
        ;
        return cookieMap;
    }
    ;
    static isEmptyString(string) {
        if (!string || string.trim() === '') {
            return true;
        }
        ;
        return false;
    }
    ;
}
;

;// CONCATENATED MODULE: ./src/ts/components/global/topNavbar.ts


function topNavbar() {
    themeSwitcher();
    displayAdditionalLinks();
}
;
function displayAdditionalLinks() {
    const AuthToken = Cookies.get('AuthToken');
    const topNavLinksContainer = document.querySelector('.top-nav-container .links-container');
    if (!AuthToken || AuthToken.length !== 32 || !AuthToken.startsWith('a')) {
        return;
    }
    ;
    topNavLinksContainer === null || topNavLinksContainer === void 0 ? void 0 : topNavLinksContainer.classList.add('signed-in');
}
;

;// CONCATENATED MODULE: ./src/ts/index.ts


// initializing imports
topNavbar();

/******/ })()
;