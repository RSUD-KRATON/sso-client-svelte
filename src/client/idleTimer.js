/**
 * Inactivity & Idle Tracker (30 Menit Default)
 * Mendukung sinkronisasi aktivitas lintas tab melalui LocalStorage
 */
export const STORAGE_KEY = 'rsud_kraton_last_activity_ts';

export function setupIdleTimer(options = {}) {
    if (typeof window === 'undefined') return () => {};

    const {
        idleTimeMs = 30 * 60 * 1000,    // 30 Menit
        warningTimeMs = 60 * 1000,       // Peringatan 60 detik sebelum logout
        onWarning = () => {},
        onIdle = () => {},
        onReset = () => {}
    } = options;

    let warningInterval = null;
    let isWarningFired = false;

    function getNow() {
        return Date.now();
    }

    function resetActivity() {
        try {
            localStorage.setItem(STORAGE_KEY, getNow().toString());
        } catch {}

        if (isWarningFired) {
            isWarningFired = false;
            clearInterval(warningInterval);
            onReset();
        }
    }

    function checkInactivity() {
        const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || getNow().toString(), 10);
        const elapsed = getNow() - lastActivity;
        const remaining = idleTimeMs - elapsed;

        if (remaining <= 0) {
            clearInterval(warningInterval);
            onIdle();
        } else if (remaining <= warningTimeMs) {
            if (!isWarningFired) {
                isWarningFired = true;
                const secondsLeft = Math.ceil(remaining / 1000);
                onWarning(secondsLeft);

                warningInterval = setInterval(() => {
                    const currentElapsed = getNow() - parseInt(localStorage.getItem(STORAGE_KEY) || getNow().toString(), 10);
                    const currentRemaining = idleTimeMs - currentElapsed;
                    if (currentRemaining <= 0) {
                        clearInterval(warningInterval);
                        onIdle();
                    } else {
                        onWarning(Math.ceil(currentRemaining / 1000));
                    }
                }, 1000);
            }
        }
    }

    // Inisialisasi awal
    resetActivity();

    // Event listener interaksi pengguna
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const throttledReset = throttle(resetActivity, 2000);

    events.forEach(evt => window.addEventListener(evt, throttledReset, { passive: true }));

    // Cek aktivitas berkala setiap 5 detik
    const checkInterval = setInterval(checkInactivity, 5000);

    // Sinkronisasi tab browser lain
    const handleStorageChange = (e) => {
        if (e.key === STORAGE_KEY) {
            if (isWarningFired) {
                isWarningFired = false;
                clearInterval(warningInterval);
                onReset();
            }
        }
    };
    window.addEventListener('storage', handleStorageChange);

    return function cleanup() {
        events.forEach(evt => window.removeEventListener(evt, throttledReset));
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(checkInterval);
        if (warningInterval) clearInterval(warningInterval);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
