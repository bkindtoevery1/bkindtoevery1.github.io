// duplicate/observer-redirect.mjs
function observerRedirectURL(value) {
  const current = new URL(value), target = new URL("./tournament/observer.html", current);
  target.search = current.search;
  target.hash = current.hash;
  return target.href;
}
if (typeof window !== "undefined") window.location.replace(observerRedirectURL(window.location.href));
export {
  observerRedirectURL
};
