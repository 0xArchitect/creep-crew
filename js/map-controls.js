const KBD_KEYS = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  KeyW: 87,
  KeyA: 65,
  KeyS: 83,
  KeyD: 68,
};

const FPS = 60;
const FRAME_DURATION = Math.ceil(1000 / FPS); // ms
const ARROWS_MOVE_SPEED = 1000; // px per second
const DRAG_INERTIA_FRAME = 100; // ms
const MAX_DRAG_INERTIA_SPEED = 1000; // px per second
const DRAG_INERTIA_DAMPING = 1000; // px per second

// org. focused: "transparent 130px, rgba(0, 0, 0, 0.95) 150px)";
// oeg. default: "transparent 160px, rgba(0, 0, 0, 0.85) 200px)";
// const DEFAULT_SPOTLIGHT_SIZE = "transparent 116px, rgba(0, 0, 0, 0.93) 146px)";
// const FOCUSED_SPOTLIGHT_SIZE = "transparent 95px, rgba(0, 0, 0, 0.98) 110px)";
const DEFAULT_SPOTLIGHT_DIAMETER = 292; // px
const FOCUSED_SPOTLIGHT_SIZE_FACTOR = 0.75;
const DEFAULT_SPOTLIGHT_INSET_FACTOR = 160 / 200;
const FOCUSED_SPOTLIGHT_INSET_FACTOR = 130 / 150;
const DEFAULT_SPOTLIGHT_OPACITY = 0.85;
const FOCUSED_SPOTLIGHT_OPACITY = 0.98;
const SPOTLIGHT_ZOOM_FACTOR = 0.5;
const SPOTLIGHT_ENTER_ANIMATION_DURATION = 300;

const MIN_BG_SCALE_LIMIT = 0.2;
const MAX_BG_SCALE_LIMIT = 1;
const ZOOM_SPEED = 0.1;
const ZOOM_ANIMATION_SPEED = 2; // per second
const DEFAULT_ZOOM = 0.4;

const IGNORE_MOUSE_AFTER_TOUCH_FRAME = 3000; // ms

class CreepMapControls {
  constructor() {
    this._selector = ".bg-container";
    this._spotlightSelector = ".spotlight";

    this._initFinished = false;
    this._bgItems = [];
    this._bgScale = DEFAULT_ZOOM;
    this._bgTargetScale = DEFAULT_ZOOM;
    this._bgScaleLast = this._bgScale; // NOTE: used for hammer pinch and pinch end
    this._bgMinScale = MIN_BG_SCALE_LIMIT;

    this._bgMaxTranslate = { x: 0, y: 0 };
    this._bgTranslate = { x: 0, y: 0 };
    this._bgTranslateLastScale = this._bgScale;

    this._keys = new Set();
    this._keysDirection = { x: 0, y: 0 };

    this._isDrag = false;
    this._dragStartPos = { x: 0, y: 0 };
    this._dragStartBgPos = { x: 0, y: 0 };

    this._renderInterval = null;
    this._lastRenderTime = null;
    this._dragInertiaPoints = [];
    this._dragInertia = { speed: 0, maxSpeed: 0, maxSpeedX: 0, maxSpeedY: 0 };

    this._ignoreMouseEvents = [];
  }

  _loadBgItems() {
    const _controls = this;

    this._$bg.find(".bg-item").each(function () {
      const jqEl = $(this);

      const top = parseInt(jqEl.css("top"));
      const left = parseInt(jqEl.css("left"));
      const width = parseInt(jqEl.css("width"));
      const height = parseInt(jqEl.css("height"));

      _controls._bgItems.push({
        el: this,
        jqEl,
        box: {
          top: top,
          left: left,
          bottom: top + height,
          right: left + width,
        },
      });
    });
    
    this._$bg.find(".item").each(function () {
      const jqEl = $(this);

      const top = parseInt(jqEl.css("top"));
      const left = parseInt(jqEl.css("left"));
      const width = parseInt(jqEl.css("width"));
      const height = parseInt(jqEl.css("height"));

      _controls._bgItems.push({
        el: this,
        jqEl,
        box: {
          top: top,
          left: left,
          bottom: top + height,
          right: left + width,
        },
      });
    });


  }

  initBackground() {
    // Init Spotlight
    this._$spotlight = $(this._spotlightSelector);
    this._spotlight = this._$spotlight.get(0);
    this._spotlightPos = null;
    this._spotlightFocus = false;
    this._spotlightEnterProgress = 0;
    this._updateSpotlight();

    // Init background
    this._$bg = $(this._selector);
    this._loadBgItems();
    this._bgWidth = this._$bg.width();
    this._bgHeight = this._$bg.height();
    this._handleWindowResize();

    // Bind basic listeners.
    const _controls = this;
    $(window).resize(function () {
      _controls._handleWindowResize();
    });
    this._bindDragListeners();
  }

  init() {
    // Bind keyboard, mouse and touch gesture listeners
    this._bindKeyListeners();
    this._bindScrollWheelListeners();
    this._bindTouchGestureListeners();

    // Start the spotlight enter animation.
    this._initFinished = true;
    this._checkNeedsRender();
  }

  _getSpotlightCenterInBgCoords() {
    if (this._spotlightPos) {
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;
      const mouseOffset = {
        x: this._spotlightPos.x - winWidth / 2,
        y: this._spotlightPos.y - winHeight / 2,
      };

      return {
        x:
          this._bgWidth / 2 -
          (this._bgTranslate.x - mouseOffset.x) / this._bgScale,
        y:
          this._bgHeight / 2 -
          (this._bgTranslate.y - mouseOffset.y) / this._bgScale,
      };
    } else {
      return {
        x: this._bgWidth / 2 - this._bgTranslate.x / this._bgScale,
        y: this._bgHeight / 2 - this._bgTranslate.y / this._bgScale,
      };
    }
  }

  _containsPoint(box, point) {
    if (point.x < box.left) return false;
    if (point.y < box.top) return false;
    if (point.x > box.right) return false;
    if (point.y > box.bottom) return false;
    return true;
  }

  _checkItemHighlight() {
    const mousePos = this._getSpotlightCenterInBgCoords();

    for (let item of this._bgItems) {
      if (this._containsPoint(item.box, mousePos)) {
        item.jqEl.addClass("highlight");
      } else {
        item.jqEl.removeClass("highlight");
      }
    }
  }

  _updateSpotlight(e) {
    if (!this._spotlight) return;

    if (e) {
      if (e !== true) {
        this._spotlightPos = { x: e.pageX, y: e.pageY };
      }
    } else {
      this._spotlightPos = null;
    }

    const spotlightZoom = Math.sqrt(this._bgScale / DEFAULT_ZOOM); // Another idea.
    // const spotlightZoom =
    //   (this._bgScale / DEFAULT_ZOOM - 1) * SPOTLIGHT_ZOOM_FACTOR + 1;

    let spotlightSize =
      (DEFAULT_SPOTLIGHT_DIAMETER / 2) *
      spotlightZoom *
      Math.pow(this._spotlightEnterProgress, 2);
    if (this._spotlightFocus) spotlightSize *= FOCUSED_SPOTLIGHT_SIZE_FACTOR;
    const spotlightOpacity = this._spotlightFocus
      ? FOCUSED_SPOTLIGHT_OPACITY
      : DEFAULT_SPOTLIGHT_OPACITY;
    const spotlightInsetFactor = this._spotlightFocus
      ? FOCUSED_SPOTLIGHT_INSET_FACTOR
      : DEFAULT_SPOTLIGHT_INSET_FACTOR;
    const spotlightInsetSize = Math.round(spotlightSize * spotlightInsetFactor);
    spotlightSize = Math.round(spotlightSize);

    const spotlightCss = `transparent ${spotlightInsetSize}px, rgba(0, 0, 0, ${spotlightOpacity}) ${spotlightSize}px)`;

    if (this._spotlightPos) {
      this._spotlight.style.backgroundImage = `radial-gradient(circle at ${
        (this._spotlightPos.x / window.innerWidth) * 100
      }% ${
        (this._spotlightPos.y / window.innerHeight) * 100
      }%, ${spotlightCss}`;
    } else {
      this._spotlight.style.backgroundImage = `radial-gradient(circle, ${spotlightCss}`;
    }

    this._checkItemHighlight();
  }

  _updateBgTransform() {
    this._$bg.css(
      "transform",
      `translate(${this._bgTranslate.x}px, ${
        this._bgTranslate.y
      }px) scale(${this._bgScale.toFixed(3)})`
    );

    this._checkItemHighlight();
  }

  _calcZoomLimits() {
    // TODO: check if this works on mobile and if needs to be replaced - with main screen w and h
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    const minScaleX = winWidth / this._bgWidth;
    const minScaleY = winHeight / this._bgHeight;

    this._bgMinScale = Math.min(
      MAX_BG_SCALE_LIMIT,
      Math.max(minScaleX, minScaleY, MIN_BG_SCALE_LIMIT)
    );
    this._setZoomScaleEnd(this._bgScale);
  }

  _trimZoomScale(scale) {
    return Math.max(this._bgMinScale, Math.min(MAX_BG_SCALE_LIMIT, scale));
  }

  _setZoomScale(scale) {
    this._bgScale = this._trimZoomScale(scale);
    this._bgTargetScale = this._bgScale;
    this._handleZoomChange();
  }

  _setZoomScaleEnd(scale) {
    this._setZoomScale(scale);
    this._bgScaleLast = this._bgScale;
    this._handleZoomChange();
  }

  _setZoomTargetScale(scale) {
    this._bgTargetScale = this._trimZoomScale(scale);
    this._checkNeedsRender();
  }

  _setZoomScaleAnimated(scale) {
    this._bgScale = this._trimZoomScale(scale);
    this._bgScaleLast = this._bgScale;
    this._handleZoomChange();
  }

  _handleZoomChange() {
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Scale translate with the zoom.
    if (this._bgScale !== this._bgTranslateLastScale) {
      const zoomChange = this._bgScale / this._bgTranslateLastScale;
      const newTranslate = {
        x: this._bgTranslate.x,
        y: this._bgTranslate.y,
      };

      // Zoom where the spotlight/mouse is focused.
      let mouseOffset = null;
      if (this._spotlightPos) {
        mouseOffset = {
          x: this._spotlightPos.x - winWidth / 2,
          y: this._spotlightPos.y - winHeight / 2,
        };
        newTranslate.x -= mouseOffset.x;
        newTranslate.y -= mouseOffset.y;
      }

      newTranslate.x *= zoomChange;
      newTranslate.y *= zoomChange;

      // Zoom where the spotlight/mouse is focused.
      if (mouseOffset) {
        newTranslate.x += mouseOffset.x;
        newTranslate.y += mouseOffset.y;
      }

      newTranslate.x = Math.round(newTranslate.x);
      newTranslate.y = Math.round(newTranslate.y);

      this._bgTranslate = newTranslate;
      this._bgTranslateLastScale = this._bgScale;
    }

    const maxX = Math.max(
      0,
      Math.floor((this._bgWidth * this._bgScale - winWidth) / 2)
    );
    const maxY = Math.max(
      0,
      Math.floor((this._bgHeight * this._bgScale - winHeight) / 2)
    );

    this._bgMaxTranslate = { x: maxX, y: maxY };
    this._boundBgTranslate();
    this._updateBgTransform();
    this._updateSpotlight(true);
  }

  _handleWindowResize() {
    this._calcZoomLimits();
    this._handleZoomChange();
  }

  _boundBgTranslate() {
    const max = this._bgMaxTranslate;
    this._bgTranslate = {
      x: Math.min(max.x, Math.max(-max.x, this._bgTranslate.x)),
      y: Math.min(max.y, Math.max(-max.y, this._bgTranslate.y)),
    };
  }

  _setBgTranslate(pos) {
    this._bgTranslate = { x: pos.x, y: pos.y };
    this._boundBgTranslate();
    this._updateBgTransform();
  }

  _moveBg(delta) {
    this._bgTranslate = {
      x: this._bgTranslate.x + delta.x,
      y: this._bgTranslate.y + delta.y,
    };

    this._boundBgTranslate();
    this._updateBgTransform();
  }

  _recordDragInertiaPoint(e) {
    const cTime = Date.now();
    this._dragInertiaPoints.push({ x: e.pageX, y: e.pageY, time: cTime });
    while (this._dragInertiaPoints.length > 2) {
      const firstPoint = this._dragInertiaPoints[0];
      let pointAge = cTime - firstPoint.time;
      if (pointAge > DRAG_INERTIA_FRAME) this._dragInertiaPoints.shift();
      else break;
    }
  }

  _releaseDragInertia() {
    if (this._dragInertiaPoints.length >= 2) {
      const firstPoint = this._dragInertiaPoints[0];
      const lastPoint =
        this._dragInertiaPoints[this._dragInertiaPoints.length - 1];

      const delta = {
        x: lastPoint.x - firstPoint.x,
        y: lastPoint.y - firstPoint.y,
        time: lastPoint.time - firstPoint.time,
      };

      if (delta.time > 0) {
        const maxSpeedX = (delta.x * 1000) / delta.time;
        const maxSpeedY = (delta.y * 1000) / delta.time;
        const maxSpeed = Math.sqrt(
          maxSpeedX * maxSpeedX + maxSpeedY * maxSpeedY
        );

        this._dragInertia = {
          speed: Math.min(maxSpeed, MAX_DRAG_INERTIA_SPEED),
          maxSpeed,
          maxSpeedX,
          maxSpeedY,
        };
        this._checkNeedsRender();
      }
    }
    this._dragInertiaPoints = [];
  }

  _startDrag(e) {
    this._isDrag = true;
    this._dragStartPos = { x: e.pageX, y: e.pageY };
    this._dragStartBgPos = { x: this._bgTranslate.x, y: this._bgTranslate.y };
    this._dragInertiaPoints = [];
    this._dragInertia = { speed: 0, maxSpeed: 0, maxSpeedX: 0, maxSpeedY: 0 };
    this._recordDragInertiaPoint(e);
  }

  _moveDrag(e) {
    if (!this._isDrag) return;
    this._recordDragInertiaPoint(e);
    this._$spotlight.addClass("dragging");
    const dragDelta = {
      x: e.pageX - this._dragStartPos.x,
      y: e.pageY - this._dragStartPos.y,
    };
    const newBgPos = {
      x: this._dragStartBgPos.x + dragDelta.x,
      y: this._dragStartBgPos.y + dragDelta.y,
    };
    this._setBgTranslate(newBgPos);
  }

  _endDrag(e) {
    if (!this._isDrag) return;
    this._recordDragInertiaPoint(e);
    this._releaseDragInertia();
    this._isDrag = false;
    this._$spotlight.removeClass("dragging");
  }

  _checkIsButton(target) {
    const $target = $(target);
    if ($target.closest(".logo").length) return true;
    if ($target.closest(".twitter-icon").length) return true;
    if ($target.closest(".sound-control").length) return true;
    return false;
  }

  _removeOldTouchEvents(cTime) {
    while (this._ignoreMouseEvents.length > 0) {
      const firstEvt = this._ignoreMouseEvents[0];
      let evtAge = cTime - firstEvt.time;
      if (evtAge > IGNORE_MOUSE_AFTER_TOUCH_FRAME)
        this._ignoreMouseEvents.shift();
      else break;
    }
  }

  _ignoreNextMouseEvent(touch) {
    const cTime = Date.now();
    this._ignoreMouseEvents.push({
      x: touch.pageX,
      y: touch.pageY,
      time: cTime,
    });
    this._removeOldTouchEvents(cTime);
  }

  _checkIgnoreNextMouseEvent(e) {
    const cTime = Date.now();
    this._removeOldTouchEvents(cTime);
    if (this._ignoreMouseEvents.length > 0) return true;
    // for (let evt of this._ignoreMouseEvents) {
    //   if (evt.x == e.pageX && evt.y === e.pageY) return true;
    // }
    return false;
  }

  _bindDragListeners() {
    const _controls = this;

    // Mouse drag.
    window.addEventListener("mousemove", (e) => {
      if (_controls._checkIgnoreNextMouseEvent(e)) return;
      _controls._updateSpotlight(e);
      if (!_controls._initFinished) return;
      _controls._moveDrag(e);
    });
    window.addEventListener("mousedown", (e) => {
      if (_controls._checkIgnoreNextMouseEvent(e)) return;
      if (_controls._checkIsButton(e.target)) return;
      if (_controls._initFinished) this._spotlightFocus = true;
      _controls._updateSpotlight(e);
      if (!_controls._initFinished) return;
      _controls._startDrag(e);
    });
    window.addEventListener("mouseup", (e) => {
      if (_controls._checkIgnoreNextMouseEvent(e)) return;
      this._spotlightFocus = false;
      _controls._updateSpotlight(e);
      if (!_controls._initFinished) return;
      _controls._endDrag(e);
    });

    // Touch drag.
    window.addEventListener("touchmove", (e) => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0] || e.changedTouches[0];
      _controls._ignoreNextMouseEvent(touch);
      if (!_controls._initFinished) return;

      _controls._moveDrag(touch);
    });
    window.addEventListener("touchstart", (e) => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0] || e.changedTouches[0];
      _controls._ignoreNextMouseEvent(touch);
      if (!_controls._initFinished) return;

      if (_controls._checkIsButton(touch.target)) return;
      // this._spotlightFocus = true;
      // _controls._updateSpotlight();
      _controls._startDrag(touch);
    });
    window.addEventListener("touchend", (e) => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0] || e.changedTouches[0];
      _controls._ignoreNextMouseEvent(touch);
      if (!_controls._initFinished) return;

      // this._spotlightFocus = false;
      // _controls._updateSpotlight();
      _controls._endDrag(touch);
    });
    // TODO: check if "touchcancel" is required
  }

  _bindScrollWheelListeners() {
    document.addEventListener("wheel", (e) => {
      if (e.deltaY > 0) {
        this._setZoomTargetScale(this._bgTargetScale - ZOOM_SPEED);
      } else {
        this._setZoomTargetScale(this._bgTargetScale + ZOOM_SPEED);
      }
    });
  }

  _bindTouchGestureListeners() {
    if (!this._spotlight) return;

    const _controls = this;
    const hammer = new Hammer(this._spotlight, {});
    hammer.get("pinch").set({
      enable: true,
    });

    hammer.on("pinch pinchend", function (ev) {
      if (ev.type == "pinch") {
        _controls._setZoomScale(_controls._bgScaleLast * ev.scale);
      }
      if (ev.type == "pinchend") {
        _controls._setZoomScaleEnd(_controls._bgScale);
      }
    });

    hammer.on("doubletap", function (ev) {
      _controls._setZoomScaleEnd(DEFAULT_ZOOM);
    });
  }

  _resolveKbdKey(e) {
    const key = e.keyCode || e.which;
    const code = e.code;
    for (const kbdKeyCode in KBD_KEYS) {
      if (!KBD_KEYS.hasOwnProperty(kbdKeyCode)) return;
      if (kbdKeyCode === code) return kbdKeyCode;
      const kbdKeyKey = KBD_KEYS[kbdKeyCode];
      if (kbdKeyKey === key) return kbdKeyCode;
    }
    return null;
  }

  _startRenderInterval() {
    if (this._renderInterval != null) return;
    this._lastRenderTime = Date.now();
    this._renderInterval = setInterval(() => {
      this._render();
    }, FRAME_DURATION);
  }

  _stopRenderInterval() {
    if (this._renderInterval == null) return;
    clearInterval(this._renderInterval);
    this._renderInterval = null;
    this._render();
  }

  _checkNeedsRender() {
    if (
      this._keysDirection.x !== 0 ||
      this._keysDirection.y !== 0 ||
      this._dragInertia.speed > 0 ||
      this._bgScale !== this._bgTargetScale ||
      this._spotlightEnterProgress < 1
    ) {
      this._startRenderInterval();
    } else {
      this._stopRenderInterval();
    }
  }

  _reCalcKeysDirection() {
    const k = this._keys;
    this._keysDirection = {
      x:
        -1 * (k.has("ArrowRight") || k.has("KeyD")) +
        1 * (k.has("ArrowLeft") || k.has("KeyA")),
      y:
        -1 * (k.has("ArrowDown") || k.has("KeyS")) +
        1 * (k.has("ArrowUp") || k.has("KeyW")),
    };
    this._checkNeedsRender();
  }

  _bindKeyListeners() {
    const _controls = this;

    $(document).on("keydown", function (e) {
      const key = _controls._resolveKbdKey(e);
      if (key != null) {
        _controls._keys.add(key);
        _controls._reCalcKeysDirection();
      }
    });

    $(document).on("keyup", function (e) {
      const key = _controls._resolveKbdKey(e);
      if (key != null) {
        _controls._keys.delete(key);
        _controls._reCalcKeysDirection();
      }
    });
  }

  _render() {
    const cTime = Date.now();
    const delta = cTime - this._lastRenderTime;
    this._lastRenderTime = cTime;

    let factor =
      Math.abs(this._keysDirection.x) + Math.abs(this._keysDirection.y);
    const HAS_ARROW_MOVE = factor > 0;
    const HAS_DRAG_INERTIA = this._dragInertia.speed > 0;
    const HAS_ZOOM = this._bgScale !== this._bgTargetScale;
    const HAS_SPOTLIGHT_ENTER = this._spotlightEnterProgress < 1;

    if (HAS_ARROW_MOVE) {
      let movePx = Math.round(
        (ARROWS_MOVE_SPEED * delta) / (1000 * Math.sqrt(factor))
      );

      this._moveBg({
        x: this._keysDirection.x * movePx,
        y: this._keysDirection.y * movePx,
      });
    }

    if (HAS_DRAG_INERTIA) {
      const moveX =
        (this._dragInertia.speed * delta * this._dragInertia.maxSpeedX) /
        (this._dragInertia.maxSpeed * 1000);
      const moveY =
        (this._dragInertia.speed * delta * this._dragInertia.maxSpeedY) /
        (this._dragInertia.maxSpeed * 1000);
      this._moveBg({
        x: Math.round(moveX),
        y: Math.round(moveY),
      });

      // Damp drag inertia speed.
      const speedDamp = (DRAG_INERTIA_DAMPING * delta) / 1000;
      this._dragInertia.speed -= speedDamp;
    }

    if (HAS_ZOOM) {
      const zoomDir = this._bgTargetScale > this._bgScale ? 1 : -1;
      const zoomDelta = (ZOOM_ANIMATION_SPEED * delta) / 1000;
      let newScale = this._bgScale + zoomDelta * zoomDir;
      if (zoomDir > 0 && newScale >= this._bgTargetScale)
        newScale = this._bgTargetScale;
      else if (zoomDir < 0 && newScale <= this._bgTargetScale)
        newScale = this._bgTargetScale;
      this._setZoomScaleAnimated(newScale);
    }

    if (HAS_SPOTLIGHT_ENTER) {
      const spotlightDelta = delta / SPOTLIGHT_ENTER_ANIMATION_DURATION;
      this._spotlightEnterProgress = Math.min(
        1,
        this._spotlightEnterProgress + spotlightDelta
      );
      this._updateSpotlight(true);
    }

    if (
      !HAS_ARROW_MOVE &&
      !HAS_DRAG_INERTIA &&
      !HAS_ZOOM &&
      !HAS_SPOTLIGHT_ENTER
    ) {
      this._checkNeedsRender();
    }
  }
}
