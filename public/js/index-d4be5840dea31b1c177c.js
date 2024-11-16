(()=>{"use strict";function e(){!function(){setTimeout((()=>{var e;null===(e=document.querySelector("#transition-pause"))||void 0===e||e.remove()}),100);const e=localStorage.getItem("darkTheme");if(!e||!JSON.parse(e))return document.documentElement.classList.remove("dark"),localStorage.setItem("darkTheme",JSON.stringify(!1)),void o("light");document.documentElement.classList.add("dark"),o("dark")}();const e=document.querySelector("#theme-switcher");null==e||e.addEventListener("click",n),null==e||e.addEventListener("keyup",t)}function t(e){"Enter"===e.key&&n()}function n(){const e=localStorage.getItem("darkTheme");if(!(e?JSON.parse(e):null))return document.documentElement.classList.add("dark"),localStorage.setItem("darkTheme",JSON.stringify(!0)),void o("dark");document.documentElement.classList.remove("dark"),localStorage.setItem("darkTheme",JSON.stringify(!1)),o("light")}function o(e){const t=document.querySelector("#theme-switcher");"dark"!==e?null==t||t.classList.remove("dark-theme"):null==t||t.classList.add("dark-theme")}class i{static get(e){const t=this.createCookieMap().get(e);return t||null}static set(e,t,n){document.cookie=n?`${e}=${t}; max-age=${n}; path=/; Secure`:`${e}=${t}; path=/; Secure`}static remove(e){document.cookie=`${e}=; max-age=0`}static createCookieMap(){const e=document.cookie,t=new Map;if(""===e)return t;const n=e.split("; ");for(const e of n){const n=e.split("=")[0],o=e.split("=")[1];t.set(n,o)}return t}}function a(){i.remove("authToken"),i.remove("guestHangoutId"),document.dispatchEvent(new CustomEvent("signedOut"))}function c(e,t,n=2e3){(""===e.trim()||n&&n<=0)&&(n=2e3);const o=document.querySelector("#popup");o&&o.remove();const i=function(e){const t=document.createElement("div");return t.id="popup",t.className=e,t}(t);i.appendChild(function(e){const t=document.createElement("span");return t.appendChild(document.createTextNode(e)),t}(e)),document.body.appendChild(i),requestAnimationFrame((()=>{requestAnimationFrame((()=>{i.classList.add("in-view")}))})),setTimeout((()=>{i.classList.remove("in-view"),setTimeout((()=>i.remove()),150)}),n||2e3)}class s{static display(){if(document.querySelector("#loading-modal"))return;const e=this.createModal();document.body.appendChild(e)}static remove(){const e=document.querySelector("#loading-modal");null==e||e.remove()}static createModal(){const e=document.createElement("div");return e.id="loading-modal",e.appendChild(this.createModalSpinner()),e}static createModalSpinner(){const e=document.createElement("div");return e.className="spinner",e}}function r(e){if(e.length<34)return!1;if(!e.startsWith("a")&&!e.startsWith("g"))return!1;if("_"!==e[32])return!1;if(!Number.isInteger(+e.substring(33)))return!1;return/^[A-Za-z0-9_]{34,}$/.test(e)}class l{static display(e){const t=document.querySelector("#confirm-modal");t&&t.remove();const n=this.createConfirmModal(e);return document.body.appendChild(n),n.focus(),requestAnimationFrame((()=>{requestAnimationFrame((()=>{n.classList.add("revealed")}))})),n}static remove(){const e=document.querySelector("#confirm-modal");null==e||e.classList.remove("revealed"),setTimeout((()=>null==e?void 0:e.remove()),150)}static createConfirmModal(e){const t=document.createElement("div");t.id="confirm-modal",t.setAttribute("tabindex","0"),e.description&&(t.className="has-description");const n=document.createElement("div");if(n.id="confirm-modal-container",n.appendChild(this.createModalTitle(e.title)),e.description){const t=this.createDescriptionContainer();for(const n of e.description.split("\n"))t.appendChild(this.createModalDescription(n));n.appendChild(t)}return n.appendChild(this.createBtnContainer(e)),t.appendChild(n),t}static createModalTitle(e){const t=document.createElement("p");return t.className="confirm-modal-title",t.appendChild(document.createTextNode(e)),t}static createDescriptionContainer(){const e=document.createElement("div");return e.className="description-container",e}static createModalDescription(e){const t=document.createElement("p");return t.className="confirm-modal-description",t.appendChild(document.createTextNode(e)),t}static createBtnContainer(e){const t=document.createElement("div");return t.className="btn-container",t.appendChild(this.createBtnElement("confirm-btn",e.confirmBtnTitle,e.isDangerousAction)),t.appendChild(this.createBtnElement("cancel-btn",e.cancelBtnTitle)),e.extraBtnTitle&&t.appendChild(this.createBtnElement("other-btn",e.extraBtnTitle)),t}static createBtnElement(e,t,n){const o=document.createElement("button");return o.id=`confirm-modal-${e}`,o.setAttribute("type","button"),o.appendChild(document.createTextNode(t)),n&&(o.className="danger"),o}}const d=document.querySelector(".top-nav"),u=document.querySelector("#account-nav-container-btn");function m(e){if(e.target instanceof HTMLElement)if(e.target.classList.contains("sign-out-btn")){e.preventDefault();const t={title:"Are you sure you want to sign out of your account?",description:null,confirmBtnTitle:"Confirm",cancelBtnTitle:"Cancel",extraBtnTitle:null,isDangerousAction:!0};l.display(t).addEventListener("click",(e=>{if(e.preventDefault(),e.target instanceof HTMLElement)return"confirm-modal-confirm-btn"===e.target.id?(s.display(),a(),c("Signed out successfully.","success"),void setTimeout((()=>window.location.reload()),1e3)):void("confirm-modal-cancel-btn"!==e.target.id||l.remove())}))}else;}function p(e){e.preventDefault();const t=document.querySelector("#account-nav-container-links");if(null==t?void 0:t.classList.contains("expanded"))return null==u||u.classList.remove("expanded"),setTimeout((()=>t.classList.remove("expanded")),150),void requestAnimationFrame((()=>{requestAnimationFrame((()=>{t.style.opacity="0"}))}));null==u||u.classList.add("expanded"),null==t||t.classList.add("expanded"),requestAnimationFrame((()=>{requestAnimationFrame((()=>{t&&(t.style.opacity="1")}))}))}function f(){const e=i.get("authToken");if(e)return r(e)?void(e.startsWith("g")?null==d||d.classList.add("guest-user"):null==d||d.classList.add("account-user")):(null==d||d.classList.remove("guest-user","account-user"),void i.remove("authToken"));null==d||d.classList.remove("guest-user","account-user")}const v=document.querySelector(".bot-nav"),g=document.querySelector("#account-list-btn"),h=document.querySelector("#account-list-container");function y(e){if(e.target instanceof HTMLEmbedElement)if(e.target.classList.contains("sign-out-btn")){e.preventDefault();const t={title:"Are you sure you want to sign out of your account?",description:null,confirmBtnTitle:"Confirm",cancelBtnTitle:"Cancel",extraBtnTitle:null,isDangerousAction:!0};l.display(t).addEventListener("click",(e=>{if(e.preventDefault(),e.target instanceof HTMLElement)return"confirm-modal-confirm-btn"===e.target.id?(s.display(),a(),c("Signed out successfully.","success"),void setTimeout((()=>window.location.reload()),1e3)):void("confirm-modal-cancel-btn"!==e.target.id||l.remove())}))}else;}function L(){const e=i.get("authToken");if(e)return r(e)?void(e.startsWith("g")?null==v||v.classList.add("guest-user"):null==v||v.classList.add("account-user")):(null==v||v.classList.remove("guest-user","account-user"),void i.remove("authToken"));null==v||v.classList.remove("guest-user","account-user")}function T(){if(null==g?void 0:g.classList.contains("expanded"))return setTimeout((()=>null==g?void 0:g.classList.remove("expanded")),150),void requestAnimationFrame((()=>{requestAnimationFrame((()=>{h&&(h.style.opacity="0")}))}));null==g||g.classList.add("expanded"),requestAnimationFrame((()=>{requestAnimationFrame((()=>{h&&(h.style.opacity="1")}))}))}e(),f(),null==u||u.addEventListener("click",p),null==d||d.addEventListener("click",m),document.addEventListener("signedOut",f),L(),null==g||g.addEventListener("click",T),null==v||v.addEventListener("click",y),document.addEventListener("signedOut",L)})();