# SSO Client Svelte (@kraton/sso-client-svelte)

> **SDK & Library Resmi Autentikasi Single Sign-On (SSO) Portal RSUD Kraton Pekalongan untuk Svelte 5 & SvelteKit 2.**

Library ini menyederhanakan integrasi autentikasi terpusat SSO Portal RSUD Kraton ke dalam seluruh aplikasi web internal (SIMRS, E-Apotik, Alur Klinis, E-Sharing, dll) dengan fitur lengkap:
- 🚀 **Konfigurasi Paten Standar Tim IT RSUD Kraton** (menggunakan parameter resmi `client_id` dan `callback`).
- 🔐 **Multi-Tier Token Verification**: JWT Payload Decode + HTTP SSO REST API Validation.
- ⏱️ **Auto Inactivity & Idle Tracker (30 Menit)**: Otomatis memicu logout jika tidak ada aktivitas selama 30 menit demi keamanan sistem medis.
- 🔄 **Sliding Session Expiration**: Otomatis memperpanjang masa aktif token cookie saat pengguna aktif bekerja.
- 🎨 **Komponen UI Svelte 5 Siap Pakai**: `<SsoLoginButton />` & `<IdleTimeoutModal />`.
- 🛡️ **Middleware SvelteKit Hook (`createSsoHandle`)**: Proteksi route otomatis, intersep logout instan tanpa caching.

---

## 📦 1. Cara Instalasi

Anda dapat menginstal library ini langsung dari repositori GitHub RSUD Kraton:

```bash
# Menggunakan npm
npm install https://github.com/RSUD-KRATON/sso-client-svelte.git

# Atau jika sudah dipublikasikan ke package registry
npm install @kraton/sso-client-svelte
```

---

## ⚙️ 2. Konfigurasi Paten `.env` (Standar Tim IT)

Tambahkan variabel environment berikut ke file `.env` aplikasi Anda:

```env
# ==============================================================================
# KONFIGURASI SINGLE SIGN-ON (SSO) PORTAL RSUD KRATON PEKALONGAN (PATEN)
# ==============================================================================
URL_SERVER_SSO=http://sso.simrs
SSO_CLIENT_ID=eapotik_v1
SSO_REDIRECT_URI=http://eapotik.simrs/sso/callback
SESSION_SECRET=rsudkraton_eapotik_session_secret_2026
COOKIE_SECURE=false
```

> [!IMPORTANT]
> **Aturan Paten Parameter SSO:**
> - Parameter URL pengalihan login SSO **WAJIB** menggunakan:
>   `http://sso.simrs/login?client_id=NAMA_CLIENT&callback=URL_CALLBACK`
> - `client_id` harus sudah terdaftar aktif di tabel `DBSIMRS.dbo.user_sso_clients`.

---

## 🚀 3. Panduan Integrasi Cepat (3 Langkah)

### Langkah 1: Inisialisasi SSO Client di `$lib/server/sso.js`

Buat file `src/lib/server/sso.js`:

```javascript
import { env } from '$env/dynamic/private';
import { createSsoClient } from '@kraton/sso-client-svelte/server';

export const sso = createSsoClient({
    ssoServerUrl: env.URL_SERVER_SSO || 'http://sso.simrs',
    clientId: env.SSO_CLIENT_ID || 'eapotik_v1',
    callbackUrl: env.SSO_REDIRECT_URI || 'http://eapotik.simrs/sso/callback',
    sessionSecret: env.SESSION_SECRET || 'rsudkraton_sso_secret_2026',
    cookieSecure: env.COOKIE_SECURE === 'true' || env.COOKIE_SECURE === '1'
});
```

---

### Langkah 2: Pasang Middleware di `src/hooks.server.js`

Gunakan `createSsoHandle` untuk memproteksi seluruh rute privat secara otomatis:

```javascript
import { sso } from '$lib/server/sso.js';
import { createSsoHandle } from '@kraton/sso-client-svelte/server';

export const handle = createSsoHandle(sso, {
    publicRoutes: [
        '/login',
        '/auth',
        '/sso',
        '/api/test',
        '/_app',
        '/favicon'
    ],
    loginPath: '/login',
    defaultRedirect: '/'
});
```

---

### Langkah 3: Buat Endpoint Autentikasi

#### A. Endpoint Redirect ke SSO: `src/routes/auth/sso/+server.js`
```javascript
import { sso } from '$lib/server/sso.js';
import { redirect } from '@sveltejs/kit';

export async function GET() {
    throw redirect(303, sso.getLoginUrl());
}
```

#### B. Endpoint Callback SSO: `src/routes/sso/callback/+server.js`
```javascript
import { sso } from '$lib/server/sso.js';
import { redirect } from '@sveltejs/kit';

export async function GET({ url, cookies }) {
    const token = url.searchParams.get('token') || url.searchParams.get('access_token') || url.searchParams.get('code');

    if (!token) {
        throw redirect(303, '/login?error=' + encodeURIComponent('Token SSO tidak ditemukan'));
    }

    const user = await sso.verifyToken(token);
    if (!user) {
        throw redirect(303, '/login?error=' + encodeURIComponent('Validasi Token SSO Gagal'));
    }

    // Set cookie sesi 30 menit
    sso.setSessionCookie(cookies, user);

    throw redirect(303, '/');
}
```

#### C. Endpoint Logout: `src/routes/auth/logout/+server.js`
```javascript
import { sso } from '$lib/server/sso.js';
import { redirect, json } from '@sveltejs/kit';

export async function GET({ url, cookies, setHeaders }) {
    sso.clearSessionCookie(cookies);

    setHeaders({
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    const reason = url.searchParams.get('reason');
    if (reason) {
        throw redirect(303, `/login?reason=${encodeURIComponent(reason)}`);
    }
    throw redirect(303, '/login');
}
```

---

## 🎨 4. Komponen UI Svelte 5

### Tombol Login SSO di `src/routes/login/+page.svelte`

```svelte
<script>
    import { SsoLoginButton } from '@kraton/sso-client-svelte';
</script>

<div class="max-w-md mx-auto p-6">
    <SsoLoginButton 
        ssoAuthUrl="/auth/sso" 
        label="Masuk dengan SSO RSUD Kraton" 
    />
</div>
```

---

### Inactivity Tracker & Modal Peringatan di `src/routes/+layout.svelte`

```svelte
<script>
    import { page } from '$app/stores';
    import { setupIdleTimer } from '@kraton/sso-client-svelte/client';
    import { IdleTimeoutModal } from '@kraton/sso-client-svelte';

    let { data, children } = $props();

    let isIdleWarningVisible = $state(false);
    let idleCountdown = $state(60);

    $effect(() => {
        if (data?.user && $page.url.pathname !== '/login') {
            const cleanup = setupIdleTimer({
                idleTimeMs: 30 * 60 * 1000, // 30 Menit
                warningTimeMs: 60 * 1000,    // Peringatan 60 detik sebelum logout
                onWarning: (seconds) => {
                    idleCountdown = seconds;
                    isIdleWarningVisible = true;
                },
                onReset: () => {
                    isIdleWarningVisible = false;
                },
                onIdle: () => {
                    isIdleWarningVisible = false;
                    window.location.replace('/auth/logout?reason=idle');
                }
            });

            return () => {
                if (cleanup) cleanup();
            };
        }
    });
</script>

{@render children()}

<!-- Modal Peringatan Idle 30 Menit -->
<IdleTimeoutModal
    bind:isVisible={isIdleWarningVisible}
    countdown={idleCountdown}
    logoutUrl="/auth/logout?reason=idle"
    onStayLoggedIn={() => isIdleWarningVisible = false}
/>
```

---

## 📄 Lisensi
Dilisensikan di bawah [MIT License](LICENSE). Dikelola oleh **Tim IT & SIMRS RSUD Kraton Pekalongan**.
