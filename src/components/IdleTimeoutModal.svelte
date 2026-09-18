<script>
    /**
     * Komponen Modal Peringatan Idle Timeout 30 Menit (Svelte 5)
     */
    let {
        isVisible = $bindable(false),
        countdown = 60,
        logoutUrl = '/auth/logout?reason=idle',
        onStayLoggedIn = () => {}
    } = $props();
</script>

{#if isVisible}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans">
        <div class="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-100 ring-1 ring-amber-500/20">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <svg class="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-base font-bold text-white leading-tight">Peringatan Tidak Ada Aktivitas</h3>
                    <p class="text-xs text-amber-400/90 font-medium mt-0.5">Sistem Keamanan Akun Terpusat RSUD Kraton</p>
                </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed mb-4">
                Tidak ada aktivitas terdeteksi selama hampir 30 menit. Demi alasan keamanan sistem rumah sakit, sesi Anda akan otomatis keluar dalam:
            </p>

            <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-center mb-5">
                <span class="text-3xl font-extrabold text-amber-400 font-mono tracking-wider">{countdown}</span>
                <span class="text-xs text-slate-400 ml-1">detik</span>
            </div>

            <div class="flex gap-2.5">
                <button
                    type="button"
                    onclick={onStayLoggedIn}
                    class="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                    <span>Saya Masih Bekerja (Tetap Masuk)</span>
                </button>
                <a
                    href={logoutUrl}
                    class="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center justify-center cursor-pointer"
                >
                    Keluar
                </a>
            </div>
        </div>
    </div>
{/if}
