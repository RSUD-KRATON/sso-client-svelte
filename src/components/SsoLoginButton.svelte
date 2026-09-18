<script>
    /**
     * Komponen Tombol Login SSO Portal RSUD Kraton (Svelte 5)
     */
    let {
        ssoAuthUrl = '/auth/sso',
        label = 'Masuk dengan SSO RSUD Kraton',
        subLabel = 'Menggunakan Akun Terpusat Single Sign-On RSUD Kraton',
        className = '',
        onclick = null
    } = $props();

    function handleClick(e) {
        if (onclick) {
            onclick(e);
        } else {
            window.location.href = ssoAuthUrl;
        }
    }
</script>

<div class="rsud-sso-container w-full">
    <button
        type="button"
        onclick={handleClick}
        class="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded-xl text-sm font-bold tracking-wide transition shadow-lg shadow-teal-900/40 flex items-center justify-center gap-2.5 border border-teal-400/30 group cursor-pointer {className}"
    >
        <svg class="w-5 h-5 text-teal-200 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        <span>{label}</span>
    </button>
    {#if subLabel}
        <p class="text-[11px] text-slate-500 text-center mt-2">
            {subLabel}
        </p>
    {/if}
</div>
