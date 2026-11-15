import { reactive } from 'vue'
import { projectIndex } from '~/data/projects'

/**
 * Which case study is open, shared by the lantern buttons, the card and deep links.
 * `pending` is a project waiting to open as soon as its lantern is lit and settled on screen
 * (a #slug link on arrival, or a hash change); ProjectCard.vue picks it up.
 */
export const projectUi = reactive({ index: -1, pending: -1 })

let opener: ((i: number, from: HTMLElement | null) => void) | null = null

/** ProjectCard registers how to open; the lantern buttons call openProject. */
export function registerProjectOpener(fn: typeof opener) {
  opener = fn
}

export function openProject(i: number, from: HTMLElement | null = null) {
  opener?.(i, from)
}

/** The project a URL hash names (#rexolve), or -1. */
export const projectFromHash = (hash = location.hash) => (hash.length > 1 ? projectIndex(decodeURIComponent(hash.slice(1))) : -1)

/** Show a project in the address bar (or clear it), without adding history entries. */
export function setProjectHash(slug: string | null) {
  history.replaceState(history.state, '', `${location.pathname}${location.search}${slug ? `#${slug}` : ''}`)
}
