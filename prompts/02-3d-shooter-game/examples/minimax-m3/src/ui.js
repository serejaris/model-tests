// Lightweight HUD updater. No framework.

export class UI {
  constructor() {
    this.hpBar = document.getElementById('hp-bar');
    this.hpVal = document.getElementById('hp-val');
    this.ammoBar = document.getElementById('ammo-bar');
    this.ammoVal = document.getElementById('ammo-val');
    this.enemiesVal = document.getElementById('enemies-val');
    this.message = document.getElementById('message');
    this.hit = document.getElementById('hit');
    this.overlay = document.getElementById('overlay');
    this.startBtn = document.getElementById('start-btn');

    this._msgTimer = 0;
    this._hitTimer = 0;
  }

  setHP(hp, maxHp) {
    const pct = Math.max(0, hp / maxHp) * 100;
    this.hpBar.style.width = pct + '%';
    this.hpBar.parentElement.classList.toggle('low', pct < 30);
    this.hpVal.textContent = Math.max(0, Math.round(hp));
  }

  setAmmo(ammo, magSize) {
    const pct = Math.max(0, ammo / magSize) * 100;
    this.ammoBar.style.width = pct + '%';
    this.ammoBar.parentElement.classList.toggle('low', pct < 30);
    this.ammoVal.textContent = Math.max(0, Math.round(ammo));
  }

  setEnemies(n) {
    this.enemiesVal.textContent = n;
  }

  flashMessage(text, duration = 1.2) {
    this.message.textContent = text;
    this.message.classList.add('show');
    this._msgTimer = duration;
  }

  flashHit() {
    this.hit.classList.add('show');
    this._hitTimer = 0.18;
  }

  update(dt) {
    if (this._msgTimer > 0) {
      this._msgTimer -= dt;
      if (this._msgTimer <= 0) this.message.classList.remove('show');
    }
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) this.hit.classList.remove('show');
    }
  }

  showOverlay(state, label) {
    this.overlay.classList.remove('hidden', 'win', 'lose');
    if (state === 'win') this.overlay.classList.add('win');
    if (state === 'lose') this.overlay.classList.add('lose');
    this.overlay.querySelector('h1').textContent = label;
    this.overlay.querySelector('p').textContent = state === 'win'
      ? 'all enemies eliminated'
      : state === 'lose'
        ? 'you died'
        : 'low poly fps · cs 1.6 vibes';
    this.overlay.querySelector('.btn').textContent = state ? 'RESTART' : 'CLICK TO PLAY';
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }

  onStart(cb) {
    this.startBtn.addEventListener('click', cb);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) cb();
    });
  }
}
