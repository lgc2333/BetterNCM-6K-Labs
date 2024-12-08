export enum LikeStatus {
  INDIFFERENT = 'INDEFFERENT',
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
}

export enum RepeatType {
  NONE = 'NONE',
  ALL = 'ALL',
  ONE = 'ONE',
}

export interface PlayerInfo {
  hasSong: boolean
  isPaused: boolean
  volumePercent: number
  seekbarCurrentPosition: number
  seekbarCurrentPositionHuman: string
  statePercent: number
  likeStatus: string
  repeatType: string
}

export interface TrackInfo {
  author: string
  title: string
  album: string
  cover: string
  duration: number
  durationHuman: string
  url: string
  id: string
  isVideo: boolean
  isAdvertisement: boolean
  inLibrary: boolean
}

export interface Query {
  player: PlayerInfo
  track: TrackInfo
}

export interface Provider {
  query(): Query
}

export interface Album {
  alias: string[]
  id: number
  name: string
  picUrl: string
  transNames?: string[]
  transName?: string[]
}

export interface Artist {
  alias: string[]
  id: number
  name: string
  tns?: string[]
  trans?: string
}

export interface PlayingSongData {
  album: Album
  alias: string[]
  artists: Artist[]
  id: number
  name: string
  transNames?: string[]
}

export interface PlayingSong {
  data: PlayingSongData
  state: number
}

export const emptyQuery: Query = {
  player: {
    hasSong: false,
    isPaused: true,
    volumePercent: 0,
    seekbarCurrentPosition: 0,
    seekbarCurrentPositionHuman: '0:00',
    statePercent: 0,
    likeStatus: LikeStatus.INDIFFERENT,
    repeatType: RepeatType.NONE,
  },
  track: {
    author: '',
    title: '',
    album: '',
    cover: '',
    duration: 0,
    durationHuman: '0:00',
    url: '',
    id: '',
    isVideo: false,
    isAdvertisement: false,
    inLibrary: false,
  },
}

export const reactInstance = (e: HTMLElement): any => {
  const k = Object.keys(e).find((v) =>
    v.includes('__reactInternalInstance'),
  )! as keyof typeof e
  return e[k]
}

export function parseTimeStr(time: string): number {
  const [min, sec] = time.split(':').map((x) => parseInt(x, 10))
  return min * 60 + sec
}

export const formatName = (name: string, ...restNames: string[]) =>
  restNames.length === 0 ? name : `${name}（${restNames[0]}）`

export function elemVisible(e: HTMLElement): boolean {
  const style = window.getComputedStyle(e)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

export class DOMProvider implements Provider {
  query(): Query {
    const playing: PlayingSong | null = betterncm.ncm.getPlayingSong()
    if (!playing) return emptyQuery

    const currentPlayerElem = [
      ...document.querySelectorAll<HTMLDivElement>('.m-player'),
    ].find(elemVisible)
    if (!currentPlayerElem) return emptyQuery

    const isPaused = playing.state === 1

    const volumePercent = parseFloat(
      currentPlayerElem
        .querySelector<HTMLDivElement>('.prg-spk .has.j-flag')!
        .style.height.replace(/%$/, ''),
    )

    const seekbarCurrentPositionHuman =
      currentPlayerElem.querySelector<HTMLTimeElement>('time.now')!.innerText
    const seekbarCurrentPosition = parseTimeStr(seekbarCurrentPositionHuman)
    const statePercent =
      parseFloat(
        currentPlayerElem
          .querySelector<HTMLDivElement>('.prg-ply .has')!
          .style.width.replace(/%$/, ''),
      ) / 100

    const likeStatus = document.querySelector('.m-pinfo span.icn-loved')
      ? LikeStatus.LIKE
      : LikeStatus.INDIFFERENT

    const repeatType = currentPlayerElem.querySelector<HTMLDivElement>(
      'type.type-order',
    )
      ? RepeatType.NONE
      : currentPlayerElem.querySelector<HTMLDivElement>('type.type-one')
        ? RepeatType.ONE
        : RepeatType.ALL

    const author = playing.data.artists
      .map((v) =>
        formatName(v.name, ...(v.tns ?? []), ...(v.trans ? [v.trans] : []), ...v.alias),
      )
      .join(' / ')
    const album = formatName(
      playing.data.album.name,
      ...(playing.data.album.transNames ?? []),
      ...(playing.data.album.transName ?? []),
      ...playing.data.album.alias,
    )

    const title = formatName(
      playing.data.name,
      ...(playing.data.transNames ?? []),
      ...playing.data.alias,
    )
    const cover = playing.data.album.picUrl

    const durationHuman =
      currentPlayerElem.querySelector<HTMLTimeElement>('time.all')!.innerText
    const duration = parseTimeStr(durationHuman)

    const id = `${playing.data.id}`
    const url = `https://music.163.com/song?id=${id}`

    return {
      player: {
        hasSong: true,
        isPaused,
        volumePercent,
        seekbarCurrentPosition,
        seekbarCurrentPositionHuman,
        statePercent,
        likeStatus,
        repeatType,
      },
      track: {
        author,
        title,
        album,
        cover,
        duration,
        durationHuman,
        url,
        id,
        isVideo: false,
        isAdvertisement: false,
        inLibrary: false,
      },
    }
  }
}

export const provider = new DOMProvider()
