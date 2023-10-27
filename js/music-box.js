const CREEP_SONG_LIST = ["audio-creep"];
const LOCAL_STORAGE_KEY_MUTE = "_MUTE";

// TODO: handle tab out of focus

class CreepMusicBox {
  constructor(loader) {
    this._initialized = false;
    this._isPlaying = false;
    this._loader = loader;
    this._isMuted = !!JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY_MUTE) || "false"
    );
    this._songs = [];
    this._activeIndex = -1;

    this._audioFadeOut = false;
    this._tabFocus = true;
    this._tabVisibility = true;
  }

  _playNextSong() {
    this._activeIndex = (this._activeIndex + 1) % this._songs.length;
    const nextSong = this._songs[this._activeIndex];
    nextSong.seek(0);
    nextSong.play();
  }

  _audioFadeOutChange(value) {
    if (this._audioFadeOut === value) return;
    this._audioFadeOut = value;
    if (this._audioFadeOut) {
      for (let song of this._songs) song.fade(1, 0, 1000);
    } else {
      for (let song of this._songs) song.fade(0, 1, 1000);
    }
  }

  _tabFocusChange(value) {
    this._tabFocus = value;
    this._audioFadeOutChange(!this._tabFocus && !this._tabVisibility);
    // this._audioFadeOutChange(!this._tabFocus);
  }

  _tabVisibilityChange(value) {
    this._tabVisibility = value;
    this._audioFadeOutChange(!this._tabFocus && !this._tabVisibility);
    // this._audioFadeOutChange(!this._tabFocus);
  }

  _handleFocus() {
    for (let song of this._songs) song.fade(0, 1, 1000);
  }

  _handleBlur() {
    for (let song of this._songs) song.fade(1, 0, 1000);
  }

  _init() {
    if (!this._loader.isFinished()) return false;
    if (this._initialized) return true;
    this._initialized = true;
    this._songs = CREEP_SONG_LIST.map((resName) =>
      this._loader.getAudio(resName)
    );
    const _musicBox = this;
    for (let song of this._songs) {
      song.on("end", () => {
        _musicBox._playNextSong();
      });
    }
    if (this._isMuted) for (let song of this._songs) song.mute(true);

    // Tab focus.
    window.addEventListener("focus", () => {
      _musicBox._tabFocusChange(true);
    });
    window.addEventListener("blur", () => {
      _musicBox._tabFocusChange(false);
    });
    _musicBox._tabFocusChange(!!document.hasFocus());

    // Tab visibility.
    document.addEventListener("visibilitychange", () => {
      _musicBox._tabVisibilityChange(!document.hidden);
    });
    _musicBox._tabVisibilityChange(!document.hidden);

    return true;
  }

  _setMute(value) {
    this._isMuted = value;
    localStorage.setItem(LOCAL_STORAGE_KEY_MUTE, String(value));
  }

  play() {
    if (!this._init()) return;
    if (this._isPlaying) return;
    this._isPlaying = true;
    this._playNextSong();
  }

  isMuted() {
    return this._isMuted;
  }

  mute() {
    this._setMute(true);
    for (let song of this._songs) song.mute(true);
  }

  unmute() {
    this._setMute(false);
    for (let song of this._songs) song.mute(false);
    this.play();
  }
}
