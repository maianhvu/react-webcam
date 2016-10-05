import React, { Component, PropTypes } from 'react';

function hasGetUserMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

export default class Webcam extends Component {
  static defaultProps = {
    audio: true,
    screenshotFormat: 'image/webp',
    onUserMedia: () => {},
    aspectRatio: 16/9,
    mirrored: false
  };

  static propTypes = {
    audio: PropTypes.bool,
    muted: PropTypes.bool,
    onUserMedia: PropTypes.func,
    screenshotFormat: PropTypes.oneOf([
      'image/webp',
      'image/png',
      'image/jpeg'
    ]),
    className: PropTypes.string,
    mirrored: PropTypes.bool,
    aspectRatio: PropTypes.number
  };

  static mountedInstances = [];

  static userMediaRequested = false;

  constructor() {
    super();
    this.state = {
      hasUserMedia: false
    };
  }

  componentDidMount() {
    if (!hasGetUserMedia()) return;

    Webcam.mountedInstances.push(this);

    if (!this.state.hasUserMedia && !Webcam.userMediaRequested) {
      this.requestUserMedia();
    }
  }

  requestUserMedia() {
    navigator.getUserMedia = navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia;

    let sourceSelected = (audioSource, videoSource) => {
      let constraints = {
        video: {
          optional: [{sourceId: videoSource}]
        }
      };

      if (this.props.audio) {
        constraints.audio = {
          optional: [{sourceId: audioSource}]
        };
      }

      navigator.getUserMedia(constraints, (stream) => {
        Webcam.mountedInstances.forEach((instance) => instance.handleUserMedia(null, stream));
      }, (e) => {
        Webcam.mountedInstances.forEach((instance) => instance.handleUserMedia(e));
      });
    };

    if (this.props.audioSource && this.props.videoSource) {
      sourceSelected(this.props.audioSource, this.props.videoSource);
    } else {
      if ('mediaDevices' in navigator) {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          let audioSource = null;
          let videoSource = null;

          devices.forEach((device) => {
            if (device.kind === 'audio') {
              audioSource = device.id;
            } else if (device.kind === 'video') {
              videoSource = device.id;
            }
          });

          sourceSelected(audioSource, videoSource);
        })
        .catch((error) => {
          console.log(`${error.name}: ${error.message}`); // eslint-disable-line no-console
        });
      } else {
        MediaStreamTrack.getSources((sources) => {
          let audioSource = null;
          let videoSource = null;

          sources.forEach((source) => {
            if (source.kind === 'audio') {
              audioSource = source.id;
            } else if (source.kind === 'video') {
              videoSource = source.id;
            }
          });

          sourceSelected(audioSource, videoSource);
        });
      }
    }

    Webcam.userMediaRequested = true;
  }

  handleUserMedia(error, stream) {
    if (error) {
      this.setState({
        hasUserMedia: false
      });

      return;
    }

    let src = window.URL.createObjectURL(stream);

    this.stream = stream;
    this.setState({
      hasUserMedia: true,
      src
    });

    this.props.onUserMedia();
  }

  componentWillUnmount() {
    let index = Webcam.mountedInstances.indexOf(this);
    Webcam.mountedInstances.splice(index, 1);

    if (Webcam.mountedInstances.length === 0 && this.state.hasUserMedia) {
      if (this.stream.stop) {
        this.stream.stop();
      } else {
        if (this.stream.getVideoTracks) {
          for (let track of this.stream.getVideoTracks()) {
            track.stop();
          }
        }
        if (this.stream.getAudioTracks) {
          for (let track of this.stream.getAudioTracks()) {
            track.stop();
          }
        }
      }
      Webcam.userMediaRequested = false;
      window.URL.revokeObjectURL(this.state.src);
    }
  }

  getScreenshot() {
    if (!this.state.hasUserMedia) return null;

    let canvas = this.getCanvas();
    return canvas.toDataURL(this.props.screenshotFormat);
  }

  getCanvas() {
    if (!this.state.hasUserMedia) return null;

    const video = this.videoElement;

    let drawRect = {
      x: 0,
      y: 0,
      width: video.videoWidth,
      height: video.videoHeight
    };

    if (!this.ctx) {
      let canvas = document.createElement('canvas');
      let context = canvas.getContext('2d');

      const videoAspectRatio = video.videoWidth / video.videoHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const backingStoreRatio = context.webkitBackingStorePixelRatio ||
        context.mozBackingStorePixelRatio ||
        context.msBackingStorePixelRatio ||
        context.oBackingStorePixelRatio ||
        context.backingStorePixelRatio || 1;
      const ratio = devicePixelRatio / backingStoreRatio;

      canvas.width  = video.clientWidth * ratio;
      canvas.height = (video.clientWidth / this.props.aspectRatio) * ratio;

      // Calculate drawRect
      if (this.props.aspectRatio >= 1) {
        drawRect.height = canvas.height;
        drawRect.width  = canvas.height * videoAspectRatio;
        drawRect.x = (canvas.width - drawRect.width) / 2;
      } else {
        drawRect.width  = canvas.width;
        drawRect.height = canvas.width / videoAspectRatio;
        drawRect.y = (canvas.height - drawRect.height) / 2;
      }

      this.canvas = canvas;

      if (this.props.mirrored) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      this.ctx = context;

    }

    const {ctx, canvas} = this;
    ctx.drawImage(video, drawRect.x, drawRect.y, drawRect.width, drawRect.height);

    return canvas;
  }

  render() {
    const containerStyle = {
      width: '100%',
      height: `${100/this.props.aspectRatio}%`,
      overflow: 'hidden',
      position: 'relative'
    };

    const videoStyle = {
      height: '100%',
      left: '50%',
      position: 'absolute',
      transform: 'translateX(-50%) scaleX(-1)',
    };

    return (
      <div className="react-webcam__container" style={containerStyle}>
        <video
        autoPlay
        src={this.state.src}
        muted={this.props.muted}
        className={this.props.className}
        style={videoStyle}
        ref={(videoElement) => this.videoElement = videoElement}
        />
      </div>
    );
  }
}
