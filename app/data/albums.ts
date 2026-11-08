// Photo albums shown at the campfire.
// To add a photo: drop the original into assets-src/albums/<album>/<slug>.jpg, run `npm run images`,
// then list it below. `src` is the path without the size/format suffix; alt text is required.

export interface AlbumPhoto {
  src: string
  alt: string
}

export interface Album {
  id: string
  name: string
  photos: AlbumPhoto[]
}

/** Every variant is a 4:5 crop at these widths, in AVIF and WebP. */
export const PHOTO_WIDTHS = [400, 800] as const
export const PHOTO_RATIO = 4 / 5

export const albums: Album[] = [
  {
    id: 'gym',
    name: 'Gym',
    photos: [
      { src: '/albums/gym/mirror-flex', alt: 'Mirror selfie of Alice flexing her bicep in a blue sports bra.' },
      { src: '/albums/gym/game-night', alt: 'Alice in a fuzzy jacket at a busy sports venue with screens behind her.' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    photos: [
      { src: '/albums/travel/santorini', alt: 'Blue domed churches and white rooftops above the sea in Santorini.' },
      { src: '/albums/travel/moving-castle', alt: 'A full-size replica of Howl’s Moving Castle under a bright cloudy sky.' },
      { src: '/albums/travel/mountain-lookout', alt: 'Alice sitting on a rock ledge high above a valley town.' },
      { src: '/albums/travel/trevi-fountain', alt: 'The Trevi Fountain in Rome, with turquoise water below the carved stone.' },
      { src: '/albums/travel/blossom-path', alt: 'Alice walking along a garden path under a tree covered in white blossoms.' },
      { src: '/albums/travel/lake-garden', alt: 'Alice smiling by a lake, holding up a small blue plush toy.' },
      { src: '/albums/travel/rabbit-statue', alt: 'Alice beside a giant rabbit and koi sculpture in front of an ornate painted archway.' },
      { src: '/albums/travel/dotted-wall', alt: 'Alice in sunglasses on a bench against a black and white polka-dot wall.' },
      { src: '/albums/travel/window-cat', alt: 'A fluffy orange cat lounging by a window above a city street.' },
    ],
  },
  {
    id: 'food',
    name: 'Food',
    photos: [
      { src: '/albums/food/cafe-croissants', alt: 'Croissants, a sandwich and coffee in floral teacups on a glass café table.' },
      { src: '/albums/food/katsu-udon', alt: 'A bowl of curry udon with pork katsu next to a bowl of mushroom udon with a soft egg.' },
      { src: '/albums/food/family-dinner', alt: 'A table crowded with shared dishes: steamed buns, dumplings, noodles and greens.' },
      { src: '/albums/food/steak-dinner', alt: 'A seared steak with roasted tomatoes and mushrooms on a white plate.' },
      { src: '/albums/food/bagel-coffee', alt: 'A bagel sandwich, a pastry and a black coffee on a wooden table.' },
    ],
  },
]
