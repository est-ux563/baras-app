/* app.js（バラシュナ暗記：20問ランダム版・全置換OK） */
'use strict';

/* ================= 演出・UIヘルパ ================= */
function updateMeta(qIndex, total, correct, streak, best) {
  const shown = Math.min(qIndex, total); // 表示用の現在番号
  const metaQ   = document.getElementById('meta-q');
  const metaAcc = document.getElementById('meta-acc');
  const metaSt  = document.getElementById('meta-streak');
  const bar     = document.getElementById('progress-bar');

  if (metaQ)   metaQ.textContent = `Q:${shown}/${total}`;

  // 正答率：未回答(=1問目表示時)は0%扱い、途中は (correct / 回答済み数)
  const answeredCount = Math.max(shown - 1, 0);
  const accRaw = answeredCount > 0 ? (correct / answeredCount) * 100 : 0;
  const acc = Math.max(0, Math.min(100, Math.round(accRaw)));
  if (metaAcc) metaAcc.textContent = `正答率:${isFinite(acc) ? acc : 0}%`;

  // 進捗（最後は100%固定）
  const pct = shown >= total ? 100 : Math.round(((shown - 1) / Math.max(total, 1)) * 100);
  if (bar) bar.style.width = `${pct}%`;

  if (metaSt) metaSt.textContent = `連続:${streak} (Best:${best})`;
}

/* ==== 中央フラッシュ（◎/✖） ==== */
function showJudge(isCorrect) {
  const judge = document.getElementById('judge');
  if (!judge) return;

  judge.textContent = isCorrect ? '◎' : '✖';
  judge.classList.remove('ok', 'ng', 'show');
  // 強制リフロー（連続表示でもアニメを確実に再生）
  void judge.offsetWidth;
  judge.classList.add(isCorrect ? 'ok' : 'ng', 'show');

  setTimeout(() => judge.classList.remove('show'), 800);
}

/* ==== Web Audio（効果音） ==== */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (_) {}
  }
}
function playOK() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(740, t);
  osc.frequency.exponentialRampToValueAtTime(1180, t + 0.08);
  osc.frequency.exponentialRampToValueAtTime(990,  t + 0.16);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.4, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.25);
}
function playNG() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t); osc.stop(t + 0.15);
}
['pointerdown','click','touchstart','keydown'].forEach(ev => {
  window.addEventListener(ev, () => ensureAudio(), { once: true, passive: true });
});

/* ==== 祝福パーティクル ==== */
function spawnParticles(rect) {
  const N = 14;
  for (let i = 0; i < N; i++) {
    const p = document.createElement('span');
    p.className = 'p';
    const x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * rect.width  * 0.6;
    const y = rect.top  + rect.height / 2;
    Object.assign(p.style, {
      left:  x + 'px',
      top:   y + 'px',
      '--dx': (Math.random() - 0.5) * 160 + 'px',
      '--dy': (-60 - Math.random() * 90) + 'px',
      '--s':  (0.6 + Math.random() * 0.6).toString(),
      '--h':  (Math.random() < 0.5 ? 48 : 260).toString()
    });
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 650);
  }
}
// パーティクル用の最小CSSを注入
;(() => {
  if (document.getElementById('particles-style')) return;
  const style = document.createElement('style');
  style.id = 'particles-style';
  style.textContent = `
    .p{
      position:fixed; width:6px; height:6px; border-radius:50%;
      background: hsl(var(--h), 80%, 60%);
      box-shadow:0 0 8px hsla(var(--h), 90%, 60%, .7);
      transform: translate(0,0) scale(var(--s));
      animation: rise .65s ease forwards;
      z-index:9999; pointer-events:none;
    }
    @keyframes rise{
      to{ transform: translate(var(--dx), var(--dy)) scale(.2); opacity:0 }
    }
  `;
  document.head.appendChild(style);
})();

/* ================= クイズ本体 ================= */
const BEST_KEY = 'baras_best_streak_v1';
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  // 1) データ取得
  let data;
  try {
    const res = await fetch('./data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    const app = document.getElementById('baras') || document.getElementById('app');
    if (app) app.innerHTML = `<p>データ読み込みに失敗しました。<br>原因: ${e.message}</p>`;
    return;
  }
  if (!Array.isArray(data) || data.length === 0) {
    const app = document.getElementById('baras') || document.getElementById('app');
    if (app) app.innerHTML = `<p>問題データが空です。data.json を確認してください。</p>`;
    return;
  }

  // 2) DOM参照
  const qEl       = document.getElementById('qtext');
  const choicesEl = document.getElementById('choices');
  const nextBtn   = document.getElementById('nextBtn');
  const liveEl    = document.getElementById('live');
  const optHard   = document.getElementById('opt-hard');
  if (!qEl || !choicesEl || !nextBtn) {
    throw new Error('HTML要素のID（qtext/choices/nextBtn）が一致していません。');
  }

  // 3) 状態（orderはreset()で毎回再構築）
  let order = [];
  let idx     = 0;
  let correct = 0;
  let streak  = 0;
  let best    = Number(localStorage.getItem(BEST_KEY) || 0);
  let answered = false;

  const current = () => data[order[idx]];
  const TOTAL = () => order.length; // ← その都度20を参照

  function render() {
    // クリア画面
    if (idx >= TOTAL()) {
      qEl.textContent = `おつかれ！ 結果：${correct} / ${TOTAL()}`;
      choicesEl.innerHTML = `<button class="next" id="retryBtn" aria-label="もう一度">もう一度</button>`;
      const rb = document.getElementById('retryBtn');
      if (rb) rb.onclick = reset;

      nextBtn.disabled = true;
      if (liveEl) liveEl.textContent = '';
      updateMeta(TOTAL(), TOTAL(), correct, streak, best); // ★ order.length を渡す
      return;
    }

    // ▼現在問題
    const q = current();

    answered = false;
    nextBtn.disabled = true;
    if (liveEl) liveEl.textContent = '';

    // 質問テキスト
    qEl.textContent = q.q;

    // 選択肢シャッフル
    const choiceOrder = shuffleInPlace(q.choices.map((_, i) => i));
    choicesEl.innerHTML = choiceOrder.map((origIndex, i) => `
      <button class="choice" data-idx="${origIndex}" aria-label="選択肢 ${i+1}：${q.choices[origIndex]}">
        <span class="num">${i + 1}．</span> ${q.choices[origIndex]}
      </button>
    `).join('');

    // 正解テキストエリア
    let ansBox = document.getElementById('answer');
    if (!ansBox) {
      ansBox = document.createElement('div');
      ansBox.id = 'answer';
      ansBox.className = 'answer';
      choicesEl.after(ansBox);
    }
    ansBox.textContent = '';

    updateMeta(idx + 1, TOTAL(), correct, streak, best); // ★ ここも order.length
  }

  function revealAnswerPanel(q, pickedIdx) {
    const ansBox = document.getElementById('answer');
    if (!ansBox) return;
    if (pickedIdx === q.a) { ansBox.textContent = ''; return; }
    const ansBtn  = choicesEl.querySelector(`.choice[data-idx="${q.a}"]`);
    if (ansBtn) ansBtn.classList.add('correct','reveal');
    const ansText = q.choices[q.a];
    ansBox.textContent = `正解：${ansText}`;
  }

  function onPick(pickIdx, btn) {
    if (answered) return;
    answered = true;

    const q = current();
    const ok = (pickIdx === q.a);

    choicesEl.querySelectorAll('.choice').forEach(b => b.disabled = true);

    btn.classList.add(ok ? 'correct' : 'wrong');
    if (ok) spawnParticles(btn.getBoundingClientRect());
    if (liveEl) liveEl.textContent = ok ? '◎' : '✖';
    showJudge(ok);
    ensureAudio();
    ok ? playOK() : playNG();

    if (ok) {
      correct++; streak++;
      if (streak > best) {
        best = streak;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch(_) {}
      }
    } else {
      streak = 0;
    }

    if (!ok && optHard && optHard.checked) {
      order.push(order[idx]); // 不正解は末尾に再キュー
    }

    revealAnswerPanel(q, pickIdx);
    updateMeta(idx + 1, TOTAL(), correct, streak, best);

    nextBtn.disabled = false;
  }

  choicesEl.addEventListener('click', (e) => {
    const t = e.target.closest('.choice');
    if (!t) return;
    const pick = Number(t.dataset.idx);
    if (!Number.isInteger(pick)) return;
    onPick(pick, t);
  });

  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
    if (/^[1-9]$/.test(e.key)) {
      const n = Number(e.key) - 1;
      const buttons = Array.from(choicesEl.querySelectorAll('.choice'));
      const btn = buttons[n];
      if (btn && !btn.disabled) {
        e.preventDefault();
        const pick = Number(btn.dataset.idx);
        onPick(pick, btn);
      }
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && !nextBtn.disabled) {
      e.preventDefault();
      next();
    }
  });

  function next() { if (idx < TOTAL()) idx++; render(); }

  // ★ ここで毎回「全体から20問」を再抽選
  function reset() {
    order = shuffleInPlace(Array.from({ length: data.length }, (_, i) => i)).slice(0, 20);
    idx = 0;
    correct = 0;
    streak = 0; // best は継続
    render();
  }

  nextBtn.onclick = () => { if (!nextBtn.disabled) next(); };

  // 初期描画
  reset();
}

// 起動
main().catch(e => {
  const app = document.getElementById('baras') || document.getElementById('app');
  if (app) app.innerHTML = `<p>読み込み失敗: ${e.message}</p>`;
});

/* ===== Install banner (PWA) ===== */
(() => {
  const params = new URLSearchParams(location.search);
  const wantsInstall = params.get('install') === '1';
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const banner = document.getElementById('install-banner');
  const btn = document.getElementById('install-cta');
  const cancel = document.getElementById('install-cancel');
  const msg = document.getElementById('install-msg');
  let deferredPrompt = null;

  function show(on=true){ if(banner) banner.style.display = on ? '' : 'none'; }
  if (!banner || !btn || !cancel || !msg) return;
  if (isStandalone) return;

  if (isiOS && wantsInstall) {
    msg.textContent = 'iPhone/iPadは 共有ボタン → 「ホーム画面に追加」でインストールできます';
    btn.textContent = 'OK';
    btn.onclick = () => show(false);
    cancel.onclick = () => show(false);
    show(true);
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (wantsInstall) show(true);
  });
  window.addEventListener('appinstalled', () => show(false));
  cancel.onclick = () => show(false);

  btn.onclick = async () => {
    if (!deferredPrompt) { show(false); return; }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    show(false);
  };

  setTimeout(() => { if (wantsInstall && !deferredPrompt && !isiOS) show(false); }, 5000);
})();
