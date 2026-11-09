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
      { src: '/albums/gym/barbell-meet', alt: 'Alice setting up for a deadlift on the platform at the Apex Barbell Club meet.' },
      { src: '/albums/gym/climbing-lounge', alt: 'Lying back on the padded edge of a foam pit in a bouldering gym.' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    photos: [
      { src: '/albums/travel/santorini', alt: 'Blue domed churches and white rooftops above the sea in Santorini.' },
      { src: '/albums/travel/moving-castle', alt: 'A full-size replica of Howl’s Moving Castle under a bright cloudy sky.' },
      { src: '/albums/travel/trevi-fountain', alt: 'The Trevi Fountain in Rome, with turquoise water below the carved stone.' },
      { src: '/albums/travel/blossom-path', alt: 'Alice walking along a garden path under a tree covered in white blossoms.' },
      { src: '/albums/travel/polka-dot-room', alt: 'Alice in sunglasses and a white puffer jacket, sitting on a bench in a sunlit room with polka-dot walls.' },
      { src: '/albums/travel/rabbit-statue', alt: 'Alice beside a giant rabbit and koi sculpture in front of an ornate painted archway.' },
      { src: '/albums/travel/window-cat', alt: 'A fluffy orange cat lounging by a window above a city street.' },
      { src: '/albums/travel/lantern-canal', alt: 'Red lanterns and a canopied boat on a canal at dusk, with hills behind.' },
    ],
  },
  {
    id: 'food',
    name: 'Food',
    photos: [
      { src: '/albums/food/cafe-croissants', alt: 'Croissants, a sandwich and coffee in floral teacups on a glass café table.' },
      { src: '/albums/food/sushi-set', alt: 'A plate of nigiri sushi with tamago and salmon roe, beside miso soup and soy sauce.' },
      { src: '/albums/food/katsu-udon', alt: 'A bowl of curry udon with pork katsu next to a bowl of mushroom udon with a soft egg.' },
      { src: '/albums/food/family-dinner', alt: 'A table crowded with shared dishes: steamed buns, dumplings, noodles and greens.' },
      { src: '/albums/food/birthday-cake', alt: 'A tall frosted cake topped with little paper flags of handwritten notes, held up in front of a lit Christmas tree.' },
    ],
  },
  {
    id: 'people',
    name: 'People',
    photos: [
      { src: '/albums/people/eclipse-glasses', alt: 'Friends squinting up through eclipse glasses on a sunny day in a parking lot.' },
      { src: '/albums/people/plushie-duo', alt: 'Two friends in a store, each hugging a big round plush toy.' },
      { src: '/albums/people/scarf-garden', alt: 'Alice and her sister in winter coats in front of a flowering bush.' },
      { src: '/albums/people/neon-mirror', alt: 'Two friends taking a mirror selfie in front of a sequin wall and a pink neon sign.' },
      { src: '/albums/people/bike-ride', alt: 'A selfie in a bike helmet, with two friends on bicycles behind.' },
      { src: '/albums/people/shades', alt: 'A friend in wraparound sunglasses and a floral shirt at a crowded party.' },
      { src: '/albums/people/cafe-corner', alt: 'A friend leaning against a rough plaster wall in a dim, lamp-lit restaurant.' },
      { src: '/albums/people/dinner-table', alt: 'A friend smiling across a restaurant table set with shared plates.' },
    ],
  },
]
