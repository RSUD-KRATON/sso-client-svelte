import { redirect } from '@sveltejs/kit';

/**
 * Buat SvelteKit Handle Middleware Helper untuk SSO RSUD Kraton
 */
export function createSsoHandle(ssoClient, options = {}) {
    const {
        publicRoutes = ['/login', '/auth', '/sso', '/favicon', '/_app'],
        loginPath = '/login',
        defaultRedirect = '/',
        autoSlidingSession = true
    } = options;

    return async function handle({ event, resolve }) {
        const pathname = event.url.pathname;

        // 1. Intersep Logout Segera di Layer Hook
        if (pathname === '/auth/logout' || pathname.startsWith('/auth/logout/')) {
            ssoClient.clearSessionCookie(event.cookies);
            event.locals.user = null;

            const reason = event.url.searchParams.get('reason');
            if (reason) {
                throw redirect(303, `${loginPath}?reason=${encodeURIComponent(reason)}`);
            }
            throw redirect(303, loginPath);
        }

        // 2. Ambil session user dari Cookie
        const user = ssoClient.getSessionUser(event.cookies);
        event.locals.user = user || null;

        // 3. Sliding Session Expiration (Perpanjang sesi jika user aktif dan bukan di route auth)
        const isAuthRoute = pathname === loginPath || pathname.startsWith('/auth') || pathname.startsWith('/sso');
        if (autoSlidingSession && user && !isAuthRoute && user.exp && (user.exp - Date.now() < 25 * 60 * 1000)) {
            try {
                ssoClient.setSessionCookie(event.cookies, user);
            } catch {}
        }

        // 4. Tangani Token SSO yang mungkin masuk di URL pada halaman apa pun
        const hasSsoToken = 
            event.url.searchParams.has('token') || 
            event.url.searchParams.has('access_token') || 
            event.url.searchParams.has('code') ||
            event.url.searchParams.has('sso_token');

        if (hasSsoToken && !pathname.startsWith('/auth/sso/callback') && !pathname.startsWith('/sso/callback')) {
            if (!user) {
                throw redirect(303, `/sso/callback${event.url.search}`);
            }
        }

        // 5. Cek apakah route bersifat publik
        const isPublic = publicRoutes.some(route => {
            if (typeof route === 'string') {
                return pathname === route || pathname.startsWith(route.endsWith('/') ? route : `${route}/`);
            }
            if (route instanceof RegExp) {
                return route.test(pathname);
            }
            return false;
        });

        // 6. Proteksi Route Privat
        if (!user && !isPublic) {
            const redirectTo = encodeURIComponent(pathname + event.url.search);
            throw redirect(303, `${loginPath}?redirect=${redirectTo}`);
        }

        // 7. Cegah User yang Sudah Login Membuka Halaman Login (Kecuali jika membawa reason/error)
        if (user && pathname === loginPath) {
            const hasReason = event.url.searchParams.has('reason') || event.url.searchParams.has('error') || event.url.searchParams.has('expired');
            if (!hasReason) {
                throw redirect(303, defaultRedirect);
            }
        }

        return await resolve(event);
    };
}
