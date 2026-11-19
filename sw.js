// Trabajador sin conexión de la web del carnet (versión mwo4k4nv).
// Guarda los archivos cifrados y los descifra en el propio móvil con la clave que se guardó al entrar.
const CACHE = 'carnet-mwo4k4nv';
const BASE = ['./', 'index.html', 'manifest.json', 'config.json', 'icono-180.png', 'icono-192.png', 'icono-512.png', 'app.enc', 'indice.enc'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

const leeClave = () => new Promise(res => { const r = indexedDB.open('carnet', 1); r.onupgradeneeded = () => r.result.createObjectStore('k');
  r.onsuccess = () => { const q = r.result.transaction('k').objectStore('k').get('clave'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }; r.onerror = () => res(null); });
const archivo = async n => { const c = await caches.open(CACHE); let r = await c.match(n); if (!r) { r = await fetch(n); if (!r.ok) throw new Error('sin archivo ' + n); await c.put(n, r.clone()); } return new Uint8Array(await r.arrayBuffer()); };
const descifra = async (k, b) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, k, b.slice(12)));
let indice = null; const paquetes = new Map();
async function imagen(k, nombre) {
  if (!indice) indice = JSON.parse(new TextDecoder().decode(await descifra(k, await archivo('indice.enc'))));
  const e = indice[nombre]; if (!e) return new Response('', { status: 404 });
  if (!paquetes.has(e[0])) { if (paquetes.size >= 2) paquetes.delete(paquetes.keys().next().value); paquetes.set(e[0], descifra(k, await archivo(`paquete${e[0]}.enc`))); }
  const p = await paquetes.get(e[0]);
  return new Response(p.slice(e[1], e[1] + e[2]), { headers: { 'Content-Type': 'image/webp' } });
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (u.origin !== location.origin) return;
  const ruta = u.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (ruta === 'app.html' || ruta.startsWith('imagenes/')) {
    e.respondWith((async () => {
      const k = await leeClave(); if (!k) return Response.redirect('index.html', 302);   // sin contraseña no se descifra nada
      try {
        if (ruta === 'app.html') return new Response(await descifra(k, await archivo('app.enc')), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        return await imagen(k, decodeURIComponent(ruta.slice(9)));
      } catch (err) { return new Response('No se pudo abrir: ' + err.message, { status: 500 }); }
    })());
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
