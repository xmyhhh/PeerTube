// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import * as videojs from 'video.js'
import { P2PMediaLoaderPluginOptions, PlayerNetworkInfo, VideoJSComponentInterface } from '../peertube-videojs-typings'
import { Engine, initHlsJsPlayer, initVideoJsContribHlsJsPlayer } from 'p2p-media-loader-hlsjs'
import { Events, Segment } from 'p2p-media-loader-core'
import { timeToInt } from '../utils'

// videojs-hlsjs-plugin needs videojs in window
window['videojs'] = videojs
require('@streamroot/videojs-hlsjs-plugin')

const Plugin: VideoJSComponentInterface = videojs.getPlugin('plugin')
class P2pMediaLoaderPlugin extends Plugin {

  private readonly CONSTANTS = {
    INFO_SCHEDULER: 1000 // Don't change this
  }
  private readonly options: P2PMediaLoaderPluginOptions

  private hlsjs: any // Don't type hlsjs to not bundle the module
  private p2pEngine: Engine
  private statsP2PBytes = {
    pendingDownload: [] as number[],
    pendingUpload: [] as number[],
    numPeers: 0,
    totalDownload: 0,
    totalUpload: 0
  }
  private statsHTTPBytes = {
    pendingDownload: [] as number[],
    pendingUpload: [] as number[],
    totalDownload: 0,
    totalUpload: 0
  }
  private startTime: number

  private networkInfoInterval: any

  constructor (player: videojs.Player, options: P2PMediaLoaderPluginOptions) {
    super(player, options)

    this.options = options

    if (!videojs.Html5Hlsjs) {
      const message = 'HLS.js does not seem to be supported.'
      console.warn(message)

      player.ready(() => player.trigger('error', new Error(message)))
      return
    }

    videojs.Html5Hlsjs.addHook('beforeinitialize', (videojsPlayer: any, hlsjs: any) => {
      this.hlsjs = hlsjs
    })

    initVideoJsContribHlsJsPlayer(player)

    this.startTime = timeToInt(options.startTime)

    player.src({
      type: options.type,
      src: options.src
    })

    player.one('play', () => {
      player.addClass('vjs-has-big-play-button-clicked')
    })

    player.ready(() => this.initialize())
  }

  dispose () {
    if (this.hlsjs) this.hlsjs.destroy()
    if (this.p2pEngine) this.p2pEngine.destroy()

    clearInterval(this.networkInfoInterval)
  }

  private initialize () {
    initHlsJsPlayer(this.hlsjs)

    const tech = this.player.tech_
    this.p2pEngine = tech.options_.hlsjsConfig.loader.getEngine()

    // Avoid using constants to not import hls.hs
    // https://github.com/video-dev/hls.js/blob/master/src/events.js#L37
    this.hlsjs.on('hlsLevelSwitching', (_: any, data: any) => {
      this.trigger('resolutionChange', { auto: this.hlsjs.autoLevelEnabled, resolutionId: data.height })
    })

    this.p2pEngine.on(Events.SegmentError, (segment: Segment, err) => {
      console.error('Segment error.', segment, err)

      this.options.redundancyUrlManager.removeBySegmentUrl(segment.requestUrl)
    })

    this.statsP2PBytes.numPeers = 1 + this.options.redundancyUrlManager.countBaseUrls()

    this.runStats()

    this.player.one('canplay', () => {
      if (this.startTime) {
        this.player.currentTime(this.startTime)
      }
    })
  }

  private runStats () {
    this.p2pEngine.on(Events.PieceBytesDownloaded, (method: string, size: number) => {
      const elem = method === 'p2p' ? this.statsP2PBytes : this.statsHTTPBytes

      elem.pendingDownload.push(size)
      elem.totalDownload += size
    })

    this.p2pEngine.on(Events.PieceBytesUploaded, (method: string, size: number) => {
      const elem = method === 'p2p' ? this.statsP2PBytes : this.statsHTTPBytes

      elem.pendingUpload.push(size)
      elem.totalUpload += size
    })

    this.p2pEngine.on(Events.PeerConnect, () => this.statsP2PBytes.numPeers++)
    this.p2pEngine.on(Events.PeerClose, () => this.statsP2PBytes.numPeers--)

    this.networkInfoInterval = setInterval(() => {
      const p2pDownloadSpeed = this.arraySum(this.statsP2PBytes.pendingDownload)
      const p2pUploadSpeed = this.arraySum(this.statsP2PBytes.pendingUpload)

      const httpDownloadSpeed = this.arraySum(this.statsHTTPBytes.pendingDownload)
      const httpUploadSpeed = this.arraySum(this.statsHTTPBytes.pendingUpload)

      this.statsP2PBytes.pendingDownload = []
      this.statsP2PBytes.pendingUpload = []
      this.statsHTTPBytes.pendingDownload = []
      this.statsHTTPBytes.pendingUpload = []

      return this.player.trigger('p2pInfo', {
        http: {
          downloadSpeed: httpDownloadSpeed,
          uploadSpeed: httpUploadSpeed,
          downloaded: this.statsHTTPBytes.totalDownload,
          uploaded: this.statsHTTPBytes.totalUpload
        },
        p2p: {
          downloadSpeed: p2pDownloadSpeed,
          uploadSpeed: p2pUploadSpeed,
          numPeers: this.statsP2PBytes.numPeers,
          downloaded: this.statsP2PBytes.totalDownload,
          uploaded: this.statsP2PBytes.totalUpload
        }
      } as PlayerNetworkInfo)
    }, this.CONSTANTS.INFO_SCHEDULER)
  }

  private arraySum (data: number[]) {
    return data.reduce((a: number, b: number) => a + b, 0)
  }
}

videojs.registerPlugin('p2pMediaLoader', P2pMediaLoaderPlugin)
export { P2pMediaLoaderPlugin }
