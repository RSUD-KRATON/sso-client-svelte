import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Default Configuration SSO RSUD Kraton
 */
export const DEFAULT_SSO_CONFIG = {
    ssoServerUrl: 'http://sso.simrs',
    clientId: 'eapotik_v1',
    callbackUrl: 'http://eapotik.simrs/sso/callback',
    sessionSecret: 'rsudkraton_sso_secret_key_2026',
    cookieName: 'rsud_sso_session',
    sessionDurationMs: 30 * 60 * 1000, // 30 Menit
    cookieSecure: false
};

/**
 * Inisialisasi SSO Client Instance
 */
export function createSsoClient(customConfig = {}) {
    const config = { ...DEFAULT_SSO_CONFIG, ...customConfig };

    // Sanitasi URL Server SSO (hapus trailing slash)
    config.ssoServerUrl = config.ssoServerUrl.replace(/\/+$/, '');

    return {
        config,

        /**
         * 1. URL Login SSO (mengarahkan user ke SSO Server dengan parameter paten: client_id & callback)
         */
        getLoginUrl(customCallback = '') {
            const callback = customCallback || config.callbackUrl;
            const params = new URLSearchParams();
            params.set('client_id', config.clientId);
            params.set('callback', callback);
            return `${config.ssoServerUrl}/login?${params.toString()}`;
        },

        /**
         * 2. URL Logout SSO Portal (Single Sign-Out)
         */
        getLogoutUrl(returnUrl = '') {
            const redirectTarget = returnUrl || config.callbackUrl;
            const params = new URLSearchParams();
            params.set('redirect', redirectTarget);
            params.set('callback', redirectTarget);
            params.set('client_id', config.clientId);
            return `${config.ssoServerUrl}/logout?${params.toString()}`;
        },

        /**
         * 3. Buat HTML Auto-Submit POST untuk Logout SSO (mencegah error 405 Method Not Allowed pada Laravel SSO)
         */
        renderPostLogoutHtml(returnUrl = '') {
            const redirectTarget = returnUrl || config.callbackUrl;
            const logoutAction = `${config.ssoServerUrl}/logout`;

            return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memproses Logout SSO - RSUD Kraton</title>
    <style>
        body { background-color: #020617; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        .spinner { width: 32px; height: 32px; border: 3px solid rgba(20,184,166,0.2); border-top-color: #14b8a6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        h3 { color: #f8fafc; font-size: 16px; margin: 0 0 8px; }
        p { font-size: 13px; margin: 0; }
    </style>
</head>
<body>
    <div class="card">
        <div class="spinner"></div>
        <h3>Memproses Logout SSO</h3>
        <p>Sedang menutup sesi akun Anda di Single Sign-On RSUD Kraton...</p>
        <form id="ssoLogoutForm" method="POST" action="${logoutAction}">
            <input type="hidden" name="redirect" value="${redirectTarget}" />
            <input type="hidden" name="callback" value="${redirectTarget}" />
            <input type="hidden" name="client_id" value="${config.clientId}" />
        </form>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
                var form = document.getElementById('ssoLogoutForm');
                if (form) form.submit();
            }, 80);
        });
    </script>
</body>
</html>`;
        },

        /**
         * 4. Multi-Tier Token Verification (JWT Decode & REST API SSO)
         */
        async verifyToken(token, reqMeta = {}) {
            if (!token) return null;

            // Tier 1: JWT Payload Decode
            if (token.includes('.')) {
                try {
                    const parts = token.split('.');
                    const payloadSegment = parts.length >= 3 ? parts[1] : parts[0];
                    const decodedJson = Buffer.from(payloadSegment, 'base64url').toString('utf8');
                    const payload = JSON.parse(decodedJson);

                    if (payload && typeof payload === 'object') {
                        if (payload.exp) {
                            const expMs = payload.exp > 1000000000000 ? payload.exp : payload.exp * 1000;
                            if (Date.now() > expMs) return null;
                        }

                        const userObj = payload.user || payload.data || payload;
                        const username = userObj.username || userObj.nip || userObj.nik || userObj.email || userObj.name || userObj.sub;

                        if (username) {
                            return {
                                id: userObj.id || userObj.user_id || username,
                                username: String(username),
                                nama: userObj.nama || userObj.name || userObj.nama_lengkap || username,
                                nip: userObj.nip || userObj.nik || '',
                                role: userObj.role || userObj.peran || 'petugas',
                                unit: userObj.unit || userObj.nama_unit || 'RSUD Kraton',
                                foto: userObj.foto || userObj.avatar || null,
                                source: 'SSO_JWT',
                                is_sso: true
                            };
                        }
                    }
                } catch {
                    // Lanjut ke REST API
                }
            }

            // Tier 2: HTTP API Endpoints SSO
            const candidateEndpoints = [
                `${config.ssoServerUrl}/api/user`,
                `${config.ssoServerUrl}/api/validate`,
                `${config.ssoServerUrl}/api/v1/user`,
                `${config.ssoServerUrl}/oauth/user`,
                `${config.ssoServerUrl}/api/me`,
                `${config.ssoServerUrl}/api/auth/user`,
                `${config.ssoServerUrl}/api/sso/user`,
                `${config.ssoServerUrl}/api/sso/validate`
            ];

            for (const ep of candidateEndpoints) {
                try {
                    let res = await fetch(ep, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    });

                    if (!res.ok) {
                        const urlWithToken = `${ep}?token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
                        res = await fetch(urlWithToken, {
                            headers: { 'Accept': 'application/json' }
                        });
                    }

                    if (res.ok) {
                        const data = await res.json();
                        const user = data.data || data.user || data.result || data;
                        if (user && (user.username || user.id || user.nama || user.name || user.nip)) {
                            return {
                                id: user.id || user.user_id || user.username || user.nip,
                                username: user.username || user.nip || user.email || 'user',
                                nama: user.nama || user.name || user.nama_lengkap || user.username,
                                nip: user.nip || user.nik || '',
                                role: user.role || user.peran || 'petugas',
                                unit: user.unit || user.nama_unit || 'RSUD Kraton',
                                foto: user.foto || user.avatar || null,
                                source: 'SSO_SERVER',
                                is_sso: true
                            };
                        }
                    }
                } catch {}
            }

            return null;
        },

        /**
         * 5. Buat Signed Session Token & Simpan Cookie SvelteKit
         */
        createSessionToken(userData) {
            const sessionId = userData.session_id || crypto.randomUUID();
            const payload = JSON.stringify({
                ...userData,
                session_id: sessionId,
                exp: Date.now() + config.sessionDurationMs
            });

            const base64Payload = Buffer.from(payload).toString('base64url');
            const signature = crypto.createHmac('sha256', config.sessionSecret).update(base64Payload).digest('base64url');

            return {
                token: `${base64Payload}.${signature}`,
                session_id: sessionId
            };
        },

        /**
         * 6. Verifikasi Signed Session Token
         */
        verifySessionToken(sessionToken) {
            if (!sessionToken || !sessionToken.includes('.')) return null;
            try {
                const [base64Payload, signature] = sessionToken.split('.');
                const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(base64Payload).digest('base64url');
                if (signature !== expectedSignature) return null;

                const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
                if (payload.exp && Date.now() > payload.exp) return null;

                return payload;
            } catch {
                return null;
            }
        },

        /**
         * 7. Pasang Cookie Sesi di SvelteKit
         */
        setSessionCookie(cookies, userData) {
            const { token } = this.createSessionToken(userData);
            cookies.set(config.cookieName, token, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: Boolean(config.cookieSecure),
                maxAge: Math.floor(config.sessionDurationMs / 1000)
            });
        },

        /**
         * 8. Ambil Data Pengguna dari Cookie SvelteKit
         */
        getSessionUser(cookies) {
            const token = cookies.get(config.cookieName);
            return this.verifySessionToken(token);
        },

        /**
         * 9. Bersihkan Cookie Sesi Secara Bersih & Seketika
         */
        clearSessionCookie(cookies) {
            const opts = {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: Boolean(config.cookieSecure)
            };

            cookies.delete(config.cookieName, opts);
            cookies.set(config.cookieName, '', {
                ...opts,
                maxAge: 0,
                expires: new Date(0)
            });
        }
    };
}
