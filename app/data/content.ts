// All copy on the site. Everything here is placeholder until Alice supplies final text.

export const hero = {
  greeting: 'Hey, I’m Alice',
  photo: { src: '/images/alice-1600.webp', width: 1600, height: 2053, alt: 'Alice at a wooden railing at dusk, tucking her hair back, trees behind her.' },
}

export const people = 'My interest lies in people…'

export const goal = 'and a life-long goal of mine is to drive meaningful connections, for both myself and others.'

export const earth = 'I hope to bring this into my work, by understanding how people think and designing for it.'

/** The two arrows on the meadow signpost. */
export const signArrows: { label: string; dir: 'left' | 'right' }[] = [
  { label: 'Dim Sum', dir: 'right' },
  { label: 'Deadlifts', dir: 'left' },
]

export interface Role {
  role: string
  company: string
  line: string
}

/** One lily pad per role. Add or remove entries freely; the pond adapts. */
export const roles: Role[] = [
  { role: 'Data Engineer', company: '@Blumont Annuity', line: 'Insurance' },
  { role: 'Product Strategy', company: '@RBC', line: 'Credit Cards' },
  { role: 'Operations Analyst', company: '@CIBC', line: 'Fraud Mitigation' },
]

export const about =
  'Math/BBA at the University of Waterloo and Wilfrid Laurier University. From Markham, Ontario.'

export interface ContactLink {
  label: string
  href: string
  /** Index into the constellation's anchor stars (see core/constellation.ts). */
  star: number
}

export const contacts: ContactLink[] = [
  { label: 'Email', href: 'mailto:alice.chen1@uwaterloo.ca', star: 0 },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/alice-chen-ac384/', star: 1 },
  { label: 'GitHub', href: 'https://github.com/alichnn', star: 2 },
  { label: 'Gallery', href: 'https://vsco.co/alicechen-/gallery', star: 3 },
]
