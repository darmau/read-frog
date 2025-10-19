export interface TestimonialItem {
  id: string
  name: string
  from: FromPlatforms
  date: string
  avatar: string
  link?: string
}

export enum FromPlatforms {
  Chrome = 'chrome',
  Edge = 'edge',
  X = 'x',
}

export const testimonialList: TestimonialItem[] = [
  {
    id: 'songkeys',
    name: 'songkeys',
    avatar: '/images/user/songkeys.jpg',
    from: FromPlatforms.X,
    link: 'https://x.com/songkeys/status/1942254042979226083',
    date: '2025.07.08',
  },
  {
    id: '핌르르',
    name: '핌르르',
    avatar: '/images/user/핌르르.jpg',
    from: FromPlatforms.Chrome,
    date: '2025.08.11',
  },
  {
    id: 'Holden “Holden for Work”',
    name: 'Holden “Holden for Work”',
    avatar: '/images/user/Holden.png',
    from: FromPlatforms.Chrome,
    date: '2025.08.11',
  },
  {
    id: 'MS R',
    name: 'MS R',
    avatar: '/images/user/MS R.png',
    from: FromPlatforms.Chrome,
    date: '2025.08.11',
  },
]
