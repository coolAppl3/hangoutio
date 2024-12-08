"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeRequestCookie = exports.getRequestCookie = exports.setResponseCookie = void 0;
function setResponseCookie(res, cookieName, cookieValue, maxAge, httpOnly) {
    const cookieOptions = {
        httpOnly,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge,
    };
    res.cookie(cookieName, cookieValue, cookieOptions);
}
exports.setResponseCookie = setResponseCookie;
;
function getRequestCookie(req, cookieName) {
    const requestCookies = req.cookies;
    if (requestCookies[cookieName]) {
        return requestCookies.cookieName;
    }
    ;
    return null;
}
exports.getRequestCookie = getRequestCookie;
;
function removeRequestCookie(res, cookieName, httpOnly) {
    res.clearCookie(cookieName, {
        httpOnly,
        secure: true,
        sameSite: 'strict',
        path: '/',
    });
}
exports.removeRequestCookie = removeRequestCookie;
;
