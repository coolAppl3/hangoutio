(()=>{"use strict";function t(){!function(){const t=localStorage.getItem("darkTheme");if(!t||!JSON.parse(t))return document.documentElement.classList.remove("dark"),localStorage.setItem("darkTheme",JSON.stringify(!1)),void s("light");document.documentElement.classList.add("dark"),s("dark")}();const t=document.querySelector("#theme-switcher");null==t||t.addEventListener("click",n),null==t||t.addEventListener("keyup",e)}function e(t){"Enter"===t.key&&n()}function n(){const t=localStorage.getItem("darkTheme");if(!(t?JSON.parse(t):null))return document.documentElement.classList.add("dark"),localStorage.setItem("darkTheme",JSON.stringify(!0)),void s("dark");document.documentElement.classList.remove("dark"),localStorage.setItem("darkTheme",JSON.stringify(!1)),s("light")}function s(t){const e=document.querySelector("#theme-switcher");"dark"!==t?null==e||e.classList.remove("dark-theme"):null==e||e.classList.add("dark-theme")}class o{static get(t){const e=this.createCookieMap().get(t);if(e)return e}static set(t,e,n){this.isEmptyString(t)||this.isEmptyString(e)||(document.cookie=n?`${t}=${e}; max-age=${n}; path=/; Secure`:`${t}=${e}; path=/; Secure`)}static remove(t){this.isEmptyString(t)||(document.cookie=`${t}=; max-age=0`)}static createCookieMap(){const t=document.cookie,e=new Map;if(!t)return e;const n=t.split("; ");for(const t of n){const n=t.split("=")[0],s=t.split("=")[1];e.set(n,s)}return e}static isEmptyString(t){return!t||""===t.trim()}}function c(){const t=document.querySelector("#account-list-btn"),e=document.querySelector("#account-list-container");if(null==t?void 0:t.classList.contains("expanded"))return null==t||t.classList.remove("expanded"),void requestAnimationFrame((()=>{requestAnimationFrame((()=>{e&&(e.style.opacity="0")}))}));null==t||t.classList.add("expanded"),requestAnimationFrame((()=>{requestAnimationFrame((()=>{e&&(e.style.opacity="1")}))}))}const i=document.querySelector("#test");null==i||i.addEventListener("click",(()=>{console.log(!0)})),t(),function(){const t=o.get("AuthToken"),e=document.querySelector(".top-nav");t&&32===t.length&&t.startsWith("a")&&(null==e||e.classList.add("signed-in"))}(),function(){const t=document.querySelector(".bot-nav");!function(t){o.get("AuthToken");null==t||t.classList.add("signed-in")}(t),null==t||t.addEventListener("click",c)}()})();