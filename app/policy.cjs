'use strict';
function sameOrigin(value, origin) {
  try { const u = new URL(value); return u.origin === origin && !u.username && !u.password; }
  catch { return false; }
}
function allowedRequest(value, origin) {
  if (value.startsWith('blob:')) return sameOrigin(value.slice(5), origin);
  return sameOrigin(value, origin);
}
function safeFilename(value) {
  return String(value || 'archivo').split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[ .]+$/, '').slice(0, 180) || 'archivo';
}
module.exports = {sameOrigin, allowedRequest, safeFilename};
