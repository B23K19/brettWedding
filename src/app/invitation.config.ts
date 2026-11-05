export interface ProgrammeItem {
  readonly time: string;
  readonly title: string;
  readonly note: string;
}

export interface ColourSwatch {
  readonly name: string;
  readonly hex: string;
}

export interface GalleryImage {
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
}

export interface InvitationConfig {
  readonly bride: string;
  readonly groom: string;
  readonly brideFull: string;
  readonly groomFull: string;
  readonly occasion: string;
  /** ISO-8601 date/time with an explicit offset. South African time is +02:00. */
  readonly dateIso: string;
  readonly dateLabel: string;
  readonly timeLabel: string;
  readonly venue: string;
  readonly address: string;
  readonly mapQuery: string;
  /** Digits only, including country code. Do not include +, spaces or punctuation. */
  readonly whatsapp: string;
  readonly message: readonly string[];
  readonly programme: readonly ProgrammeItem[];
  readonly palette: readonly ColourSwatch[];
  readonly images: {
    readonly hero: string;
    readonly story: string;
    readonly family: string;
    readonly programme: string;
    readonly dressCode: string;
    readonly venue: string;
    readonly gallery: readonly GalleryImage[];
  };
}

/**
 * Event content lives in one place. Confirm names, date, venue, address,
 * WhatsApp number and programme with the couple before publishing.
 * Image files belong in public/assets/images/ (served from /assets/images/).
 */
export const INVITE: InvitationConfig = {
  bride: 'Angelina',
  groom: 'Brett',
  brideFull: 'Angelina Jolie',
  groomFull: 'Brett Pitt',
  occasion: 'Lobola Luncheon',
  dateIso: '2026-12-19T13:00:00+02:00',
  dateLabel: 'Saturday, 19 December 2026',
  timeLabel: '13H00',
  venue: 'The Family Home',
  address: 'Venue address to be confirmed',
  mapQuery: 'Venue address to be confirmed',
  whatsapp: '',
  message: [
    'A love written in two hearts,',
    'now becomes a life shared as one.',
  ],
  programme: [
    { time: '13H00', title: 'Arrival and welcome', note: 'Guests are received by the families.' },
    { time: '13H30', title: 'The families meet', note: 'The traditional proceedings begin.' },
    { time: '15H00', title: 'Luncheon', note: 'Food, music and celebration.' },
    { time: '17H00', title: 'Closing words', note: 'Thanks, blessings and farewell.' },
  ],
  palette: [
    { name: 'Terracotta', hex: '#A85031' },
    { name: 'Antique gold', hex: '#C9A66B' },
    { name: 'Ivory', hex: '#F1E6D5' },
  ],
  images: {
    hero: 'assets/images/couple-hero.webp',
    story: 'assets/images/couple-story.webp',
    family: 'assets/images/family-gathering.webp',
    programme: 'assets/images/celebration-detail.webp',
    dressCode: 'assets/images/attire-detail.webp',
    venue: 'assets/images/venue.webp',
    gallery: [
      { src: 'assets/images/gallery-01.webp', alt: 'A favourite photograph of the couple', caption: 'A favourite moment.' },
      { src: 'assets/images/gallery-02.webp', alt: 'A photograph from the couple’s journey', caption: 'A memory to keep.' },
      { src: 'assets/images/gallery-03.webp', alt: 'A detail from the celebration', caption: 'The little details.' },
      { src: 'assets/images/gallery-04.webp', alt: 'A photograph of family and friends', caption: 'Together is the best place to be.' },
      { src: 'assets/images/gallery-05.webp', alt: 'A portrait of the couple', caption: 'The beginning of another chapter.' },
      { src: 'assets/images/gallery-06.webp', alt: 'A joyful celebration photograph', caption: 'A day worth remembering.' },
    ],
  },
};
