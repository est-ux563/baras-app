/* app.js（バラシュナ暗記：UI組み込み完成版・全置換OK） */
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
function showJudge(ok) {
  let node = document.getElementById('judge');
  if (!node) {
    node = document.createElement('div');
    node.id = 'judge';
    document.body.appendChild(node);
  }
  node.className = ok ? 'ok' : 'ng';
  node.textContent = ok ? '◎' : '✖';

  requestAnimationFrame(() => {
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 700);
  });
}

/* ==== Web Audio（ファイル不要の効果音） ==== */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      // 生成不可環境は無音
    }
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
  osc.start(t);
  osc.stop(t + 0.25);
}
function playNG() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(90,  t + 0.08);

  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

  osc.connect(g).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}
// 初回タップでオーディオを解放
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
      '--h':  (Math.random() < 0.5 ? 48 : 260).toString() // 金 or 紫
    });
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 650);
  }
}
// パーティクルCSS（JS注入・一度だけ）
(() => {
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
    #judge{
      position: fixed; inset:0; margin:auto; width:160px; height:160px;
      display:grid; place-items:center; font-size:110px; line-height:1;
      border-radius:24px; pointer-events:none; transform:scale(.7);
      opacity:0; transition: transform .12s ease, opacity .12s ease;
      z-index: 9998;
      backdrop-filter: blur(2px);
    }
    #judge.ok{ color:#22c55e; background:rgba(34,197,94,.12); }
    #judge.ng{ color:#ef4444; background:rgba(239,68,68,.12); }
    #judge.show{ opacity:1; transform:scale(1); }
    .choice.correct{ outline:2px solid #22c55e; }
    .choice.wrong{ outline:2px solid #ef4444; }
    .choice.reveal{ box-shadow:0 0 0 3px rgba(34,197,94,.25) inset; }
    .choice:disabled{ opacity:.9; cursor:not-allowed; }
    .answer{ margin-top:.75rem; font-weight:600; color:#ef4444; }
  `;
  document.head.appendChild(style);
})();

/* ================= クイズ本体 ================= */
const BEST_KEY = 'baras_best_streak_v1';

async function main() {
  // 1) データ取得（キャッシュ無効）
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

  // 3) 状態
  let order   = Array.from({ length: data.length }, (_, i) => i);
  let idx     = 0;
  let correct = 0;
  let streak  = 0;
  let best    = Number(localStorage.getItem(BEST_KEY) || 0);
  let answered = false;

  const current = () => data[order[idx]];

  // ユーティリティ
  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function render() {
    // クリア画面
    if (idx >= order.length) {
      qEl.textContent = `おつかれ！ 結果：${correct} / ${data.length}`;
      choicesEl.innerHTML = `<button class="next" id="retryBtn" aria-label="もう一度">もう一度</button>`;
      const rb = document.getElementById('retryBtn');
      if (rb) rb.onclick = reset;

      nextBtn.disabled = true;
      if (liveEl) liveEl.textContent = '';
      updateMeta(data.length, data.length, correct, streak, best);
      return;
    }

    // ▼現在問題
    const q = current();

    answered = false;
    nextBtn.disabled = true;
    if (liveEl) liveEl.textContent = '';

    // 選択肢はそのままの順。必要ならここでシャッフル可能
    // const map = q.choices.map((c,i)=>({c,i})); shuffleInPlace(map) ... 等
    qEl.textContent = q.q;
    choicesEl.innerHTML = q.choices.map((c, i) => `
      <button class="choice" data-idx="${i}" aria-label="選択肢 ${i+1}：${c}">
        <span class="num">${i + 1}．</span> ${c}
      </button>
    `).join('');

    // 正解テキスト用エリア（なければ作成）
    let ansBox = document.getElementById('answer');
    if (!ansBox) {
      ansBox = document.createElement('div');
      ansBox.id = 'answer';
      ansBox.className = 'answer';
      choicesEl.after(ansBox);
    }
    ansBox.textContent = '';

    updateMeta(idx + 1, data.length, correct, streak, best);
  }

  function revealAnswerPanel(q, pickedIdx, btnEl) {
    const ansBox = document.getElementById('answer');
    if (!ansBox) return;
    if (pickedIdx === q.a) {
      ansBox.textContent = '';
      return;
    }
    // 不正解時：正解ボタン強調＋下に「正解：～」
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

    // すべて無効化（連打防止）
    choicesEl.querySelectorAll('.choice').forEach(b => b.disabled = true);

    // 演出＆音
    btn.classList.add(ok ? 'correct' : 'wrong');
    if (ok) {
      const r = btn.getBoundingClientRect();
      spawnParticles(r);
    }
    if (liveEl) liveEl.textContent = ok ? '◎' : '✖';
    showJudge(ok);
    ensureAudio();
    ok ? playOK() : playNG();

    // スコア
    if (ok) {
      correct++; streak++; 
      if (streak > best) {
        best = streak;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch(_) {}
      }
    } else {
      streak = 0;
    }

    // 不正解優先モード：不正解は末尾に再キュー
    if (!ok && optHard && optHard.checked) {
      order.push(order[idx]); // 同じ問題の再出題をキューに追加
    }

    revealAnswerPanel(q, pickIdx, btn);
    updateMeta(idx + 1, data.length, correct, streak, best);

    // 次へボタン解放
    nextBtn.disabled = false;
  }

  // クリック（イベント委譲）
  choicesEl.addEventListener('click', (e) => {
    const t = e.target.closest('.choice');
    if (!t) return;
    const i = Number(t.dataset.idx);
    if (!Number.isInteger(i)) return;
    onPick(i, t);
  });

  // キーボード操作：1〜9で選択、Enter/Spaceで次へ
  window.addEventListener('keydown', (e) => {
    // 入力系要素フォーカス時は無効
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;

    // 数字キー（1-9）
    if (/^[1-9]$/.test(e.key)) {
      const n = Number(e.key) - 1;
      const btn = choicesEl.querySelector(`.choice[data-idx="${n}"]`);
      if (btn && !btn.disabled) {
        e.preventDefault();
        onPick(n, btn);
      }
      return;
    }

    // 次へ
    if (e.key === 'Enter' || e.key === ' ') {
      if (!nextBtn.disabled) {
        e.preventDefault();
        next();
      }
    }
  });

  function next() {
    if (idx < order.length) idx++;
    render();
  }

  function reset() {
    // 出題順シャッフル（固定にしたいなら以下3行を削除）
    order = Array.from({ length: data.length }, (_, i) => i);
    shuffleInPlace(order);

    idx = 0; 
    correct = 0; 
    streak = 0; // best は継続（localStorage管理）
    render();
  }

  nextBtn.onclick = () => {
    if (nextBtn.disabled) return; // 未回答なら無視
    next();
  };

  // 初期描画
  reset();
}

// 起動
main().catch(e => {
  const app = document.getElementById('baras') || document.getElementById('app');
  if (app) app.innerHTML = `<p>読み込み失敗: ${e.message}</p>`;
});
