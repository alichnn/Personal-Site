// All copy on the site. Everything here is placeholder until Alice supplies final text.

export const hero = {
  greeting: 'Hey, I’m Alice',
  photo: { src: '/images/alice-800.webp', width: 800, height: 1027, alt: 'Alice at a wooden railing at dusk, tucking her hair back, trees behind her.' },
}

export const people = 'I spend most of my time thinking about people.'

export const goal = 'A life-long goal is to make meaningful connections.'

export const earth =
  'I want to learn about human behaviour, strategize it into something as precise as a mathematical formula, and design for the subconscious.'

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

// TODO(Alice): replace the placeholder email, LinkedIn and résumé links.
export const contacts: ContactLink[] = [
  { label: 'Email', href: 'mailto:hello@alicechen.art', star: 0 },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', star: 1 },
  { label: 'GitHub', href: 'https://github.com/alichnn', star: 2 },
  { label: 'Résumé', href: '/resume.pdf', star: 3 },
]
