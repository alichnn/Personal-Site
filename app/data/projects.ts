// The projects that float on the pond as lanterns, one lantern per entry.
// Adding or removing a project is a content edit here: the lantern arc, the case-study card,
// its previous/next order and the #slug deep links all follow this list.
//
// Placeholder content from Alice's résumé; final copy and assets to come. Optional fields that
// are left out (or empty lists) simply don't show on the card.
//
// Images: drop originals into assets-src/projects/<slug>/<name>.jpg, run `npm run images`, then
// list them below as /project-images/<slug>/<name> (no size or format suffix). Alt text is required.

import imageSizes from './project-images.json'

export type ProjectType = 'ux' | 'data' | 'marketing'

/** Lanterns are grouped by type, left to right in this order. */
export const TYPE_ORDER: ProjectType[] = ['ux', 'data', 'marketing']

export interface TypeStyle {
  /** Spoken and shown with every title, so colour is never the only signal. */
  label: string
  /** The lantern's paper tint, lit from inside. */
  paper: string
  /** Its glow, and its reflection on the water. */
  glow: string
  /** The card's accent: at least 4.5:1 against the cream card, so small text in it stays readable. */
  accent: string
  /** A pale wash of the accent, for chips and highlighted results. */
  wash: string
}

export const TYPES: Record<ProjectType, TypeStyle> = {
  ux: { label: 'UX/UI', paper: '#a8ecd0', glow: '#6ff0c0', accent: '#256b58', wash: '#d9efe4' },
  data: { label: 'Data science', paper: '#bfc8ff', glow: '#93a6ff', accent: '#3e4aa6', wash: '#e0e3f7' },
  marketing: { label: 'Marketing', paper: '#ffbba6', glow: '#ff9874', accent: '#a3402a', wash: '#f6dfd4' },
}

export interface ProjectImage {
  /** Public path without the size/format suffix, e.g. /project-images/rexolve/journey-map. */
  src: string
  alt: string
  /** A clip (<src>.mp4, with sound), played in the enlarged view; the image at <src> is its poster. */
  video?: boolean
}

export interface Project {
  /** Also the deep link: alicechen.art/#<slug> opens this card. */
  slug: string
  type: ProjectType
  /** Shown after the type on the card, e.g. "Rebranding case study" → "Marketing · Rebranding case study". */
  typeDetail?: string
  title: string
  /** One line, shown under the title. */
  summary: string
  meta: {
    role?: string
    /** "Solo", or the team members. */
    team?: string
    timeframe?: string
    tools?: string[]
  }
  /** The problem or brief, in two or three sentences. */
  context?: string
  /**
   * What I did: three or four short points, each at most two lines on a desktop card.
   * **bold** and *italic* work inside a point.
   */
  contributions: string[]
  /** One to three outcomes, shown large. */
  results: { value: string; label: string }[]
  /** The results come from a model or forecast: the card labels them Projected, never as achieved. */
  resultsProjected?: boolean
  /** Small print under the results. */
  resultsNote?: string
  /** Who worked on it, shown under its own heading between the results and the gallery. */
  team?: string
  /** Two to four images; the first is the cover (preloaded from the neighbouring cards). */
  images: ProjectImage[]
  /** External pages, opened in a new tab. */
  links: { label: string; href: string }[]
}

const PROJECTS: Project[] = [
  {
    slug: 'rexolve',
    type: 'ux',
    title: 'Rexolve',
    summary: 'A companion for disability claimants whose claim stalls on missing information.',
    meta: {
      tools: ['Figma'],
    },
    context:
      'Made at the uXperience Design Jam by Sunlife in Fall 2026. Rexolve is for disability claimants whose claim has stalled because information is missing.',
    contributions: [
      'Defined the problem space for a disability-claim persona.',
      'Synthesized survey results into UX insights and design requirements.',
      'Mapped the end-to-end journey across four parties.',
      'Co-designed the Figma prototype of Rexolve’s core flows.',
    ],
    results: [{ value: '4', label: 'parties mapped across the end-to-end journey' }],
    team: 'Alice Chen, Mai Nguyen, Sunsica Sahayanathan, Don Carlo Nicolas',
    images: [
      {
        src: '/project-images/rexolve/persona',
        alt: 'Slide: meet Daniel, 34, the Family Anchor on short-term disability, frustrated while waiting on or responding to missing information. His quote: “I did my part. I need to know whose action is holding this up and when money may arrive.” Below: what he is dealing with, what the system asks of him, and what is at stake.',
      },
      {
        src: '/project-images/rexolve/analysis',
        alt: 'Slide: when the system loses track, Daniel becomes the tracker. About 80% of surveyed claimants were asked again for information they had already provided, about 60% had to follow up with another party, and about 80% said waiting on documents made them delay, nearly give up or miss a deadline. Three design requirements: completeness at the source, not being the admin of his own claim, and a sense of control.',
      },
      {
        src: '/project-images/rexolve/demo',
        video: true,
        alt: 'Video with sound: a 54-second walkthrough of the Rexolve app. Daniel answers a few spoken questions, Rexolve offers to chase his employer for a missing form, keeps him posted step by step, and gives an honest range for when money may arrive.',
      },
      { src: '/project-images/rexolve/team', alt: 'Team No Sleep Dinos presenting Rexolve on stage at the uXperience Design Jam by Sunlife.' },
    ],
    links: [{ label: 'Devpost', href: 'https://devpost.com/software/brontocover' }],
  },
  {
    slug: 'gym-calories',
    type: 'data',
    title: 'Calories Burned in the Gym',
    summary: 'Hypothesis testing on gender-based differences in calories burned, and a regression model served through an API.',
    meta: {
      tools: ['Scikit-Learn', 'Docker', 'FastAPI'],
    },
    context:
      'An analysis of calories burned in the gym: testing for gender-based differences, then predicting calories burned with a regression model.',
    contributions: [
      'Ran hypothesis tests on gender-based differences in calories burned.',
      'Built an end-to-end Scikit-Learn regression pipeline.',
      'Validated the model with 5-fold cross-validation.',
      'Containerized it with Docker and served it through FastAPI.',
    ],
    results: [{ value: 'R² ≈ 0.87', label: 'across 5-fold cross-validation' }],
    images: [
      {
        src: '/project-images/gym-calories/gender-plot',
        alt: 'Box plot of calories burned by gender. The median for men is about 930 calories and for women about 870, and both spread widely, from roughly 300 to 1,700.',
      },
      {
        src: '/project-images/gym-calories/pipeline',
        alt: 'Flowchart of the analysis: data collection, then cleaning and preprocessing, splitting into inference (hypothesis tests with t-tests and p-values) and prediction (regression with a train/test split and cross-validation, evaluated by R² and RMSE), and meeting at feature significance (α = 0.05, Bonferroni).',
      },
      {
        src: '/project-images/gym-calories/model-code',
        alt: 'Python code for the Scikit-Learn pipeline: scaling and one-hot encoding, feature selection with a linear SVR, and linear regression, scored with 5-fold cross-validation. Output: a mean score of 0.87 with a standard deviation of 0.05.',
      },
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/alichnn/Calories-Burned-Analysis' }],
  },
  {
    slug: 'harveys',
    type: 'marketing',
    title: 'Harvey’s: finding its flame',
    summary: 'A two-pillar rebrand to win back Gen Z for a Canadian burger chain whose signature customization had turned into decision fatigue.',
    meta: {
      // TODO(Alice): role, team (solo, or team and size), timeframe, tools (e.g. PowerPoint, Excel)
    },
    context:
      'Harvey’s is a well-known Canadian quick-service burger chain built on customization, but it had lost relevance with Gen Z. More than 60% of visits came from Gen X and Boomers, the menu carried 100+ SKUs (double the competitor median), and guests faced roughly 8M possible build-your-own combinations. The brand’s biggest differentiator had become a source of decision fatigue.',
    contributions: [
      'Diagnosed the positioning gap with a perceptual map (Harvey’s stuck in the middle) and a *Miles & Snow* lens that made it a Defender with a limited capital ask.',
      'Benchmarked *Subway’s Eat Fresh Refresh* (2021–2023), a directly comparable customization-first brand refresh.',
      'Weighed the alternatives (new toppings, a new product launch, better loyalty rewards) on brand fit, revenue sustainability and feasibility.',
      'Recommended **Harvey’s Hallmarks**, a 24-month rollout of **Signature Builds** (curated presets that ease ordering) and **Signature Stories** (franchisee-run local social).',
    ],
    results: [
      { value: '6.6–7.3%', label: 'top-line growth' },
      { value: '~2×', label: 'Gen Z share of visits' },
      { value: '$758M', label: 'system sales by 2030' },
    ],
    resultsProjected: true,
    team: 'Alice Chen, Michael Chen, Robert Jin, Evan Rosen, Jaclyn Wang',
    images: [
      {
        src: '/project-images/harveys/problem',
        alt: 'Slide: Harvey’s lacks top-of-mind preference. Three problems: consumers know Harvey’s, its messaging is inconsistent, and customization is confusing. The evidence: 60%+ of visits come from Gen X and Boomers, 100+ SKUs (double the median competitor menu), and 8M possible build-your-own combinations.',
      },
      {
        src: '/project-images/harveys/social-pages',
        alt: 'Slide: Appendix E, Harvey’s social media pages. Two mock Instagram profiles for Harvey’s Waterloo, with notes: franchisee-run accounts post local, credible content where Gen Z forms quality perceptions; national templates keep the brand consistent while local promos drive app pull-through and footfall; and “Vote the next Hallmark” and student-combo posts turn the menu change into a shareable moment.',
      },
    ],
    links: [],
  },
  // Optional: include only once Alice confirms.
  // {
  //   slug: 'chatime',
  //   type: 'marketing',
  //   title: 'Chatime Real Fruit Series Launch',
  //   summary: 'A go-to-market strategy and a bottom-up financial model.',
  //   meta: {},
  //   contributions: [],
  //   results: [],
  //   images: [],
  //   links: [],
  // },
]

/** In lantern order: grouped by type (UX, data, marketing), keeping the list order within a type. */
export const projects: Project[] = TYPE_ORDER.flatMap((t) => PROJECTS.filter((p) => p.type === t))

/** Pixel size of each project image's largest variant, written by `npm run images`. */
export function imageSize(src: string): [number, number] {
  const s = (imageSizes as Record<string, number[]>)[src]
  return s ? [s[0]!, s[1]!] : [1280, 800]
}

/** Every variant keeps the image's own proportions, at these widths, in AVIF and WebP. */
export const PROJECT_IMAGE_WIDTHS = [640, 1280, 1920] as const

export const projectIndex = (slug: string) => projects.findIndex((p) => p.slug === slug)

/** Splits a point into runs of plain, **bold** and *italic* text, for rendering without HTML. */
export function emphasis(text: string): { text: string; bold?: boolean; italic?: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
    .filter(Boolean)
    .map((t) => (t.startsWith('**') ? { text: t.slice(2, -2), bold: true } : t.startsWith('*') ? { text: t.slice(1, -1), italic: true } : { text: t }))
}
