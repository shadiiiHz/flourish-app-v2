export interface HeroSlide {
  id: number
  title: string
  desc: string
  image: string
}

export type CategoryTabId = 'bakery' | 'drinks'

export interface CategoryTab {
  id: CategoryTabId
  label: string
}

export interface MenuItemVariant {
  id: string
  title: string
  price: number
  weight?: string
  stock?: number
  image?: string
}

export interface MenuItem {
  id: string
  title: string
  description: string
  price: number
  images: string[]
  category?: string
  weight?: string
  ingredients?: string
  servingSize?: string
  discountPercent?: number
  stock?: number
  variants?: MenuItemVariant[]
}

export interface Category {
  id: string
  title: string
  image: string
  note?: string
  items: MenuItem[]
}

export type NewItem = MenuItem

export function getDiscountedPrice(price: number, discountPercent?: number) {
  if (!discountPercent) return price
  return Math.round((price * (1 - discountPercent / 100)) / 1000) * 1000
}

export const siteConfig = {
  hero: {
    slides: [
      {
        id: 0,
        title: '',
        desc: '',
        image: '/assets/slider/slide1.png',
      },
      {
        id: 1,
        title: '',
        desc: '',
        image: '/assets/slider/slide2.png',
      },
    ] satisfies HeroSlide[],
  },
  contact: {
    phone: '09960080286',
    whatsapp: '989960080286',
    email: 'flourishbakery2025@gmail.com',
    address: 'مازندران، نوشهر، بلوار کریمی، صد متر بعد از پاساژ لنگر',
    mapUrl: 'https://maps.app.goo.gl/Q8UY1Cci1fnvFiHs8',
    mapEmbedUrl: 'https://maps.google.com/maps?q=36.6549149,51.4902702&z=17&output=embed',
    hours: 'شنبه تا جمعه، ۹:۰۰ الی ۲۲:۳۰',
    instagram: 'https://www.instagram.com/flourishbakery.ir',
  },
}
