/* OminiX redesign preview — shared behaviour for preview.html (en) and preview-zh.html (zh-CN).
   VISUAL REFERENCE ONLY. The locale comes from <html lang>; UI strings live in T below,
   voice clips come from assets/audio/voice-samples.json (one clip set per locale). */
(() => {
  const LOCALE = document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const T = {
    en: {
      copy: 'Copy', copied: 'Copied', copyFail: 'Select ⌘C', play: 'Play', pause: 'Pause',
      meta: (c) => `Qwen3-TTS · preset “${c.voice}”${c.style ? ` · style “${c.style}”` : ''}${c.speed !== 1 ? ` · speed ${c.speed}×` : ''} · ${c.speaking_rate.toFixed(1)} syllables/s · generated in ${c.gen_s.toFixed(1)} s`,
      metric: (a, b) => [a === b ? `${a}×` : `${a}–${b}×`, 'faster than real-time · M4 Pro'],
    },
    zh: {
      copy: '复制', copied: '已复制', copyFail: '请手动复制', play: '播放', pause: '暂停',
      meta: (c) => `Qwen3-TTS · 预设音色“${c.voice}”${c.style ? ` · 风格“${c.style}”` : ''}${c.speed !== 1 ? ` · 语速 ${c.speed}×` : ''} · 每秒 ${c.speaking_rate.toFixed(1)} 字 · 生成耗时 ${c.gen_s.toFixed(1)} 秒`,
      metric: (a, b) => [a === b ? `${a}×` : `${a}–${b}×`, '快于实时 · M4 Pro'],
    },
  }[LOCALE];

  // header: transparent over hero, frosted after scroll
  const hdr = document.getElementById('hdr');
  const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // theme toggle
  document.getElementById('theme').onclick = () => {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === 'light' ? 'dark' : 'light';
  };
  // replay logo assembly
  const replay = (el) => { el.classList.remove('play-in'); void el.offsetWidth; el.classList.add('play-in'); };
  document.getElementById('heroMark').onclick = (e) => replay(e.currentTarget);
  // copy install line
  document.getElementById('copy').onclick = async (e) => {
    try { await navigator.clipboard.writeText(e.target.previousElementSibling.innerText.replace(/^\$\s*/, '')); e.target.textContent = T.copied; } catch { e.target.textContent = T.copyFail; }
    setTimeout(() => e.target.textContent = T.copy, 1600);
  };
  // scroll reveal + footer wordmark assembles when it scrolls into view
  const io = new IntersectionObserver((es) => es.forEach(x => {
    if (!x.isIntersecting) return;
    x.target.classList.add(x.target.id === 'horizon' ? 'play-in' : 'in'); io.unobserve(x.target);
  }), { threshold: .12 });
  document.querySelectorAll('.reveal, #horizon').forEach(el => io.observe(el));

  // ---------------- voice-out player (real OminiX output, per-locale clip set) ----------------
  const audio = document.getElementById('voAudio');
  if (!audio) return;
  fetch('assets/audio/voice-samples.json?v=vd2').then(r => r.json()).then(initVoice).catch(() => {});

  function initVoice(doc) {
    const CLIPS = Object.fromEntries(doc.clips.map(c => [c.id, { ...c, style: c.id.includes('excited') ? (c.tag || '').toLowerCase() : '' }]));
    window.VOICE_CLIPS = CLIPS; // read by the screenshot script
    const set = doc.locales[LOCALE];
    const useM4a = audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '';
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const main = document.querySelector('[data-player="main"]');
    const players = [...document.querySelectorAll('.vo-player')];
    main.dataset.clip = set.presets[0];
    const rtf = set.presets.map(id => CLIPS[id].rtf);
    const [big, small] = T.metric(Math.min(...rtf).toFixed(1), Math.max(...rtf).toFixed(1));
    document.getElementById('voMetric').innerHTML = `${big}<small>${small}</small>`;
    const pick = document.querySelector('.vo-pick');
    pick.hidden = set.presets.length < 2; // English page has one voice (Aiden): no picker
    pick.innerHTML = set.presets.map((id, i) =>
      `<button type="button" role="radio" aria-checked="${i === 0}" data-clip="${id}">${CLIPS[id].label}${CLIPS[id].tag ? ` <small>${CLIPS[id].tag}</small>` : ''}</button>`).join('');

    let active = null, raf = 0;
    const label = (pl, playing) => pl.querySelector('.vo-play').setAttribute('aria-label', `${playing ? T.pause : T.play} ${CLIPS[pl.dataset.clip].label}`);
    const resample = (peaks, n) => Array.from({ length: n }, (_, i) => {
      const a = Math.floor(i * peaks.length / n), b = Math.max(a + 1, Math.floor((i + 1) * peaks.length / n));
      return Math.max(...peaks.slice(a, b));
    });
    function drawWave(pl) {
      const clip = CLIPS[pl.dataset.clip], wave = pl.querySelector('.vo-wave');
      const n = Math.max(16, Math.min(clip.peaks.length, Math.floor(wave.clientWidth / 5)));
      wave.innerHTML = resample(clip.peaks, n).map(v => `<i style="height:${Math.round(v * 100)}%"></i>`).join('');
      pl.querySelector('.vo-time').textContent = `0:00 / ${fmt(clip.audio_s)}`;
    }
    function paint(pl, frac) {
      const bars = pl.querySelectorAll('.vo-wave i'), lit = Math.round(frac * bars.length);
      bars.forEach((b, i) => b.classList.toggle('on', i < lit));
    }
    function stop(pl) { if (!pl) return; pl.querySelector('.vo-play').classList.remove('is-playing'); label(pl, false); }
    function tick() {
      if (!active) return;
      const clip = CLIPS[active.dataset.clip];
      paint(active, audio.currentTime / (audio.duration || clip.audio_s));
      active.querySelector('.vo-time').textContent = `${fmt(audio.currentTime)} / ${fmt(clip.audio_s)}`;
      if (!audio.paused) raf = requestAnimationFrame(tick);
    }
    function play(pl, at = 0) {
      const clip = CLIPS[pl.dataset.clip];
      if (active !== pl) {
        if (active) { stop(active); paint(active, 0); drawWave(active); }
        audio.src = `assets/audio/${useM4a ? clip.src : clip.fallback}?v=vd2`;
        active = pl;
      }
      if (at) audio.currentTime = at * (audio.duration || clip.audio_s);
      audio.play().then(() => {
        pl.querySelector('.vo-play').classList.add('is-playing'); label(pl, true);
        cancelAnimationFrame(raf); tick();
      }).catch(() => {});
    }
    players.forEach(pl => {
      label(pl, false); drawWave(pl);
      pl.querySelector('.vo-play').addEventListener('click', () => (active === pl && !audio.paused) ? audio.pause() : play(pl));
      pl.querySelector('.vo-wave').addEventListener('click', e => {
        const r = e.currentTarget.getBoundingClientRect();
        play(pl, Math.min(.999, Math.max(0, (e.clientX - r.left) / r.width)));
      });
    });
    audio.addEventListener('pause', () => { stop(active); tick(); });
    audio.addEventListener('ended', () => { stop(active); if (active) paint(active, 1); });
    // preset picker
    const text = document.getElementById('voText'), meta = document.getElementById('voMeta');
    function select(id) {
      if (active === main) { audio.pause(); active = null; }
      main.dataset.clip = id; drawWave(main); label(main, false);
      const c = CLIPS[id];
      text.textContent = `“${c.text}”`; text.lang = c.lang;
      meta.textContent = T.meta(c);
      pick.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.clip === id)));
    }
    pick.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { select(b.dataset.clip); play(main); }));
    select(set.presets[0]);
    addEventListener('resize', () => players.forEach(pl => { if (pl !== active) drawWave(pl); }));
  }
})();
