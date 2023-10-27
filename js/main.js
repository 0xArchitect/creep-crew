$(document).ready(function () {
  const loadingFinished = () => {
    $(".main-container").removeClass("loading");
    $(".main-screen").removeClass("hidden");

    setTimeout(() => {
      controls.initBackground();
    }, 100);

    $(".loading-text-white").animate(
      { opacity: 0 },
      {
        duration: 500,
        complete: function () {
          $(".loading-screen").animate(
            { opacity: 0 },
            {
              duration: 500,
              complete: function () {
                $(".loading-screen").addClass("hidden");
              },
            }
          );
        },
      }
    );
  };

  let isEntered = false;
  $(".spotlight").on("click", function () {
    if (isEntered) return;
    isEntered = true;
    musicBox.play();

    $(".enter-overlay").animate(
      { opacity: 0 },
      {
        duration: 500,
        complete: function () {
          $(".enter-overlay").addClass("hidden");
          controls.init();
        },
      }
    );
  });

  /* Sound Control Button */
  const $soundControl = $(".sound-control");
  function turnSoundOffCss() {
    $soundControl.addClass("sound-off");
    $soundControl.find(".sound-control-on-icon").addClass("hidden");
    $soundControl.find(".sound-control-off-icon").removeClass("hidden");
  }
  function turnSoundOnCss() {
    $soundControl.removeClass("sound-off");
    $soundControl.find(".sound-control-off-icon").addClass("hidden");
    $soundControl.find(".sound-control-on-icon").removeClass("hidden");
  }
  $soundControl.on("click", function (e) {
    e.stopPropagation();
    if ($(this).hasClass("sound-off")) {
      turnSoundOnCss();
      musicBox.unmute();
    } else {
      turnSoundOffCss();
      musicBox.mute();
    }
  });

  /* Twitter Button */
  $(".twitter-icon").on("click", function (e) {
    window.location.href = "https://twitter.com/CreepCrewNFT";
  });

  /* Logo */
  $(".logo").on("click", function (e) {
    window.location.href = "https://www.creepcrew.io";
  });

  const loader = new CreepLoader(loadingFinished);
  loader.load();
  const musicBox = new CreepMusicBox(loader);
  if (musicBox.isMuted()) turnSoundOffCss();
  const controls = new CreepMapControls();
});
