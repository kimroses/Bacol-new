// functions/api/[[path]].js
//
// Proxy tipis buat SEMUA panggilan API data (folder/video) — satu-satunya
// tugasnya: terusin request ke vidoy-x.zalpro.workers.dev sambil nempelin
// API_KEY di sisi SERVER, biar key itu nggak pernah dikirim/kelihatan di
// browser client sama sekali.
//
// Pola [[path]] = "catch-all": nangkep SEMUA path setelah /api/, apapun
// panjangnya. Jadi /api/folder/xxx maupun /api/video/xxx (atau endpoint
// baru apapun nanti) otomatis kepakein tanpa perlu bikin file baru lagi.
//
// CARA PASANG:
// 1. Taruh file ini persis di: functions/api/[[path]].js
// 2. WAJIB set Environment Variable "API_KEY" di dashboard Cloudflare Pages
//    project ini (Settings -> Environment variables) — isinya SAMA PERSIS
//    dengan key yang sudah ada di Worker vidoy-x. Ini env var TERPISAH dari
//    yang di Worker (beda project di 1 akun Cloudflare yang sama), walau
//    isi value-nya sama.
// 3. Di index.html & watch.html: hapus var API_KEY, ganti var API jadi '/api',
//    dan hapus header 'X-API-Key' dari semua fetch (lihat instruksi terpisah).

const UPSTREAM = 'https://vidoy-x.zalpro.workers.dev';

export async function onRequest(context) {
  try {
    const { request, env, params } = context;
    const API_KEY = env.API_KEY || 'hQwtIQTI22dJubmGhkKl'; // fallback jaga-jaga sebelum env var sempat di-set

    const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
    const incomingUrl = new URL(request.url);

    const upstreamUrl = UPSTREAM + '/' + path + incomingUrl.search;

    const res = await fetch(upstreamUrl, {
      headers: { 'X-API-Key': API_KEY }
    });

    // Terusin response apa adanya (status, headers, body) — browser nggak
    // pernah tau ada perantara di tengah.
    return new Response(res.body, res);
  } catch (err) {
    return new Response('API PROXY ERROR: ' + (err && err.stack ? err.stack : String(err)), {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
           }
