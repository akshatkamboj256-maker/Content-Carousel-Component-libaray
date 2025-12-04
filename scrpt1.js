// script.js (ES module)
export {}; // allow module scope

class UltraCarousel {
  constructor(container, options = {}) {
    this.container = container;
    this.opts = Object.assign({
      autoplay: true,
      autoplayDelay: 3000,
      pauseOnHover: true,
      loop: true,
      lazyLoad: true,
      showThumbnails: true,
      startIndex: 0,
      transition: 'slide' // 'slide' | 'fade' | 'zoom'
    }, options);

    this.images = []; // { src, id }
    this.index = this.opts.startIndex || 0;
    this.timer = null;
    this.isPlaying = false;
    this.isPointerDown = false;
    this.startX = 0;
    this.currentTranslate = 0;

    this._build();
    this._bind();
  }

  /* ---------------- build DOM ---------------- */
  _build(){
    // root setup
    this.container.classList.add('ultracarousel-root');
    this.container.setAttribute('tabindex', '0');
    this.container.dataset.transition = this.opts.transition;

    // inner HTML
    this.container.innerHTML = `
      <div class="carousel-track" aria-live="off"></div>
      <div class="controls">
        <button class="nav-btn prev" aria-label="Previous slide"><span>&lt;</span></button>
        <button class="nav-btn next" aria-label="Next slide"><span>&gt;</span></button>
        <div class="dots" role="tablist"></div>
      </div>
    `;

    this.track = this.container.querySelector('.carousel-track');
    this.prevBtn = this.container.querySelector('.prev');
    this.nextBtn = this.container.querySelector('.next');
    this.dotsContainer = this.container.querySelector('.dots');

    // optional thumbnails container
    if (this.opts.showThumbnails) {
      this.thumbBox = document.createElement('div');
      this.thumbBox.className = 'thumbnails';
      this.container.appendChild(this.thumbBox);
    }
  }

  /* ---------------- listeners ---------------- */
  _bind(){
    // buttons
    this.nextBtn.addEventListener('click', ()=> this.next());
    this.prevBtn.addEventListener('click', ()=> this.prev());

    // keyboard
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); this.togglePlay(); }
      if (e.key === 'Escape') this.exitFullscreen();
    });

    // hover pause
    if (this.opts.pauseOnHover) {
      this.container.addEventListener('mouseenter', ()=> this.pause());
      this.container.addEventListener('mouseleave', ()=> { if (this.opts.autoplay) this.play(); });
    }

    // pointer (drag/swipe)
    this.track.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointermove', this._onPointerMove.bind(this));
    window.addEventListener('pointerup', this._onPointerUp.bind(this));
    window.addEventListener('pointercancel', this._onPointerUp.bind(this));

    // resize -> reposition
    window.addEventListener('resize', ()=> this._updatePosition());
  }

  /* ---------------- pointer handlers ---------------- */
  _onPointerDown(e){
    this.isPointerDown = true;
    this.startX = e.clientX;
    this.track.style.transition = 'none';
    if (this.timer) this.pause();
  }

  _onPointerMove(e){
    if (!this.isPointerDown) return;
    const dx = e.clientX - this.startX;
    const width = this.container.clientWidth || 1;
    const percent = (dx / width) * 100;
    // for slide mode, translate track
    if (this.opts.transition === 'slide') {
      this.track.style.transform = `translateX(${ -this.index * 100 + percent }%)`;
    }
  }

  _onPointerUp(e){
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.track.style.transition = '';

    const dx = (e.clientX || this.startX) - this.startX;
    const threshold = this.container.clientWidth * 0.12;
    if (dx > threshold) this.prev();
    else if (dx < -threshold) this.next();
    else this.goTo(this.index);

    if (this.opts.autoplay) this.play();
  }

  /* ---------------- image management ---------------- */
  setImages(list){
    // accepts array of strings or {src,id}
    this.images = list.map((it, idx) => (typeof it === 'string') ? { src: it, id: `img_${Date.now()}_${idx}` } : (it.id ? it : { src: it.src, id: it.id || `img_${Date.now()}_${idx}` }));
    this.index = Math.max(0, Math.min(this.index, this.images.length - 1));
    this._render();
  }

  addImage(src){
    this.images.push({ src, id: `img_${Date.now()}_${this.images.length}`});
    this._render();
    // go to new image
    this.goTo(this.images.length - 1);
  }

  removeImageByIndex(i){
    if (i < 0 || i >= this.images.length) return;
    const slide = this.track.children[i];
    if (slide) {
      slide.classList.add('removing');
      setTimeout(() => {
        this.images.splice(i,1);
        if (this.index >= this.images.length) this.index = Math.max(0, this.images.length - 1);
        this._render();
      }, 320);
    } else {
      this.images.splice(i,1);
      this._render();
    }
  }

  /* ---------------- rendering ---------------- */
  _render(){
    // clear
    this.track.innerHTML = '';
    this.dotsContainer.innerHTML = '';
    if (this.thumbBox) this.thumbBox.innerHTML = '';

    if (this.images.length === 0){
      const empty = document.createElement('div');
      empty.className = 'slide empty';
      empty.textContent = 'No images yet. Upload or drop images to add.';
      this.track.appendChild(empty);
      return;
    }

    // slides
    this.images.forEach((imgObj, i) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.index = i;
      slide.setAttribute('role','group');
      slide.setAttribute('aria-label', `${i+1} of ${this.images.length}`);

      const img = document.createElement('img');
      img.alt = `Slide ${i+1}`;
      img.loading = 'lazy';
      if (this.opts.lazyLoad) {
        img.dataset.src = imgObj.src;
        if (Math.abs(i - this.index) <= 1) img.src = imgObj.src;
      } else {
        img.src = imgObj.src;
      }
      slide.appendChild(img);

      // fullscreen click
      slide.addEventListener('click', (ev) => {
        // if clicked delete btn, ignore
        if (ev.target.classList.contains('delete-btn')) return;
        this.enterFullscreen(i);
      });

      // delete button
      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.type = 'button';
      del.textContent = 'Delete';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeImageByIndex(i);
      });
      slide.appendChild(del);

      this.track.appendChild(slide);

      // dot
      const dot = document.createElement('button');
      dot.className = 'dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to slide ${i+1}`);
      dot.addEventListener('click', (ev) => { ev.stopPropagation(); this.goTo(i); });
      this.dotsContainer.appendChild(dot);

      // thumbnail
      if (this.thumbBox) {
        const t = document.createElement('button');
        t.className = 'thumb';
        t.type = 'button';
        const ti = document.createElement('img');
        ti.loading = 'lazy';
        ti.src = imgObj.src;
        t.appendChild(ti);
        t.addEventListener('click', (ev) => { ev.stopPropagation(); this.goTo(i); });
        this.thumbBox.appendChild(t);
      }
    });

    this._updatePosition();
    this._updateUI();
    this._lazyLoadNearby();
    if (this.opts.autoplay) this.play();
  }

  _updatePosition(){
    if (this.opts.transition === 'slide') {
      this.track.style.transform = `translateX(${-this.index * 100}%)`;
      // ensure slides have not absolute positioning (fade mode uses absolute)
      const slides = Array.from(this.track.children);
      slides.forEach((s, idx) => {
        s.classList.toggle('active', idx === this.index);
      });
    } else if (this.opts.transition === 'fade') {
      // fade: stack slides
      const slides = Array.from(this.track.children);
      slides.forEach((s, idx) => {
        s.classList.toggle('active', idx === this.index);
      });
    } else if (this.opts.transition === 'zoom') {
      const slides = Array.from(this.track.children);
      slides.forEach((s, idx) => {
        s.classList.toggle('active', idx === this.index);
      });
      // still keep track translation for consistent layout
      this.track.style.transform = `translateX(${-this.index * 100}%)`;
    }
  }

  _updateUI(){
    // dots
    const dots = Array.from(this.dotsContainer.children);
    dots.forEach((d,i)=> d.classList.toggle('active', i === this.index));

    // thumbs
    if (this.thumbBox) {
      const thumbs = Array.from(this.thumbBox.children);
      thumbs.forEach((t,i)=> t.classList.toggle('active', i === this.index));
    }
  }

  _lazyLoadNearby(){
    if (!this.opts.lazyLoad) return;
    const imgs = Array.from(this.track.querySelectorAll('img'));
    [this.index-1, this.index, this.index+1].forEach(i => {
      const im = imgs[i];
      if (im && im.dataset && im.dataset.src && !im.src) im.src = im.dataset.src;
    });
  }

  /* ---------------- navigation ---------------- */
  goTo(i){
    if (this.images.length === 0) return;
    if (i < 0) {
      i = this.opts.loop ? this.images.length - 1 : 0;
    } else if (i >= this.images.length) {
      i = this.opts.loop ? 0 : this.images.length - 1;
    }
    this.index = i;
    this._updatePosition();
    this._updateUI();
    this._lazyLoadNearby();
  }

  next(){
    this.goTo(this.index + 1);
  }
  prev(){
    this.goTo(this.index - 1);
  }

  /* ---------------- autoplay ---------------- */
  play(){
    if (!this.opts.autoplay || this.images.length <= 1) return;
    if (this.timer) clearInterval(this.timer);
    this.isPlaying = true;
    this.timer = setInterval(()=> this.next(), this.opts.autoplayDelay);
  }
  pause(){
    this.isPlaying = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  togglePlay(){ this.isPlaying ? this.pause() : this.play(); }

  /* ---------------- fullscreen ---------------- */
  async enterFullscreen(index = this.index){
    const slides = this.track.children;
    const slide = slides[index];
    if (!slide) return;
    if (slide.requestFullscreen) await slide.requestFullscreen();
    else if (slide.webkitRequestFullscreen) await slide.webkitRequestFullscreen();
    // optional: add some fullscreen-specific styles via a class
  }
  exitFullscreen(){
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  /* ---------------- options & API ---------------- */
  setOption(key, val){
    this.opts[key] = val;
    if (key === 'transition') this.container.dataset.transition = val;
    if (key === 'showThumbnails') {
      if (!val && this.thumbBox) this.thumbBox.remove();
      else if (val && !this.thumbBox) {
        this.thumbBox = document.createElement('div'); this.thumbBox.className = 'thumbnails'; this.container.appendChild(this.thumbBox);
      }
      this._render();
    }
    if (key === 'autoplay') {
      if (val) this.play();
      else this.pause();
    }
  }

  // convenience helpers for external use
  getImages(){ return this.images.map(i => i.src); }
  getCurrentIndex(){ return this.index; }
  destroy(){
    this.pause();
    // remove listeners & DOM
    this.container.innerHTML = '';
  }
}

/* ---------- expose globally for easy usage ---------- */
window.UltraCarousel = UltraCarousel;
window.addEventListener('DOMContentLoaded', () => {
  // The HTML bootstrap in index.html will create instance
});
