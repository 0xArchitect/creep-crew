const CREEP_RESOURCES = {
  "img-bg": { type: "image", url: "./images/bg.jpg" },
  "img-black-hand": { type: "image", url: "./images/black-hand.png" },
  "img-logo": { type: "image", url: "./images/logo.png" },
  "img-logo-gray": { type: "image", url: "./images/logo-gray-1800.png" },
  "img-sound-on-red": { type: "image", url: "./icons/sound-on-red-150.png" },
  "img-sound-off-red": { type: "image", url: "./icons/sound-off-red-150.png" },
  "img-twitter-red": { type: "image", url: "./icons/twitter-red-150.png" },
  "audio-creep": { type: "audio", url: "./audio/creep.mp3" },
};

const CREEP_LOAD_LIST = [
  "img-bg",
  "img-black-hand",
  "img-logo",
  "img-logo-gray",
  "img-sound-on-red",
  "img-sound-off-red",
  "img-twitter-red",
  "audio-creep",
];

class CreepLoader {
  constructor(onLoadedCb) {
    this._onLoadedCb = onLoadedCb;
    this._audio = {};
    this._loading = new Set(CREEP_LOAD_LIST);
    this._finished = false;
  }

  isFinished() {
    return this._finished;
  }

  load() {
    for (let resName of CREEP_LOAD_LIST) {
      this._loadResource(resName);
    }
  }

  getAudio(resName) {
    return this._audio[resName];
  }

  _resourceLoaded(resName) {
    if (this._finished) return;
    this._loading.delete(resName);
    if (this._loading.size <= 0) {
      this._finished = true;
      if (this._onLoadedCb != null) {
        this._onLoadedCb();
      }
    }
  }

  _loadResource(resName) {
    if (!CREEP_RESOURCES.hasOwnProperty(resName)) {
      throw new Error(`Unknown resource "${resName}".`);
    }
    const resource = CREEP_RESOURCES[resName];
    if (resource.type === "image") {
      this._loadImage(resName, resource);
    } else if (resource.type === "audio") {
      this._loadAudio(resName, resource);
    } else if (resource.type === "video") {
      this._loadVideo(resName, resource);
    } else {
      throw new Error(`Unknown resource type "${resource.type}".`);
    }
  }

  _loadImage(resName, resource) {
    const _loader = this;
    axios
      .get(resource.url, { responseType: "arraybuffer" })
      .then((response) => response.data)
      .then((data) => {
        const blob = new Blob([data] /* , { type: "image/png" } */); // TODO: test if image type is deducted automatically
        const blobUrl = (window.URL || window.webkitURL).createObjectURL(blob);

        $(`img.${resName}`).each(function () {
          this.setAttribute("src", blobUrl);
        });
        $(`div.${resName}`).each(function () {
          this.style.backgroundImage = `url('${blobUrl}')`;
        });

        _loader._resourceLoaded(resName);
      });
  }

  _loadAudio(resName, resource) {
    const _loader = this;
    axios
      .get(resource.url, { responseType: "arraybuffer" })
      .then((response) => response.data)
      .then((data) => {
        const blob = new Blob([data], { type: "audio/mp3" });
        const blobUrl = (window.URL || window.webkitURL).createObjectURL(blob);

        const sound = new Howl({
          src: [blobUrl],
          html5: true,
        });

        this._audio[resName] = sound;

        _loader._resourceLoaded(resName);
      });
  }

  _loadVideo(resName, resource) {
    // TODO: test and debug
    const _loader = this;
    axios
      .get(resource.url, {
        responseType: "arraybuffer",
        headers: { Accept: "video/mp4;charset=UTF-8" },
      })
      .then((response) => response.data)
      .then((data) => {
        const blob = new Blob([data], { type: "video/mp4" });
        const blobUrl = (window.URL || window.webkitURL).createObjectURL(blob);

        const vid = $(`video.${resName}`).get(0);
        if (!vid) {
          throw new Error(`No video element with class "${resName}" found.`);
        }
        vid.setAttribute("src", blobUrl);
        vid.play().then((_) => {
          if (!resource.play) vid.pause();
        });

        _loader._resourceLoaded(resName);
      });
  }
}
