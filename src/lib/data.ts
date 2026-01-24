import type { User, Event, Photo, FaceMatch } from './types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => PlaceHolderImages.find(p => p.id === id)?.imageUrl || '';

export const users: User[] = [
  { id: 'user-1', name: 'Alice Johnson', email: 'alice@example.com', avatarUrl: findImage('avatar-1') },
  { id: 'user-2', name: 'Bob Williams', email: 'bob@example.com', avatarUrl: findImage('avatar-2') },
  { id: 'user-3', name: 'Charlie Brown', email: 'charlie@example.com', avatarUrl: findImage('avatar-3') },
  { id: 'user-4', name: 'Diana Prince', email: 'diana@example.com', avatarUrl: findImage('avatar-4') },
];

export const events: Event[] = [
  {
    id: 'event-1',
    name: 'InnovateX 2024 Conference',
    description: 'The premier annual conference for tech innovators and leaders. Join us for three days of inspiring talks, workshops, and networking.',
    ownerId: 'user-1',
    participantIds: ['user-1', 'user-2', 'user-3'],
    coverImageUrl: findImage('event-cover-1'),
    joinCode: 'INNO24'
  },
  {
    id: 'event-2',
    name: 'Emily & John\'s Wedding',
    description: 'Celebrating the wedding of Emily and John. A day of love, laughter, and happily ever after.',
    ownerId: 'user-4',
    participantIds: ['user-1', 'user-2', 'user-4'],
    coverImageUrl: findImage('event-cover-2'),
    joinCode: 'EMJO24'
  },
  {
    id: 'event-3',
    name: 'Summer Music Fest',
    description: 'An unforgettable weekend of live music, food, and fun under the sun. Featuring top artists from around the world.',
    ownerId: 'user-2',
    participantIds: ['user-1', 'user-2', 'user-3', 'user-4'],
    coverImageUrl: findImage('event-cover-3'),
    joinCode: 'SUMMER24'
  },
];

export const photos: Photo[] = [
  {
    id: 'photo-1',
    eventId: 'event-1',
    uploaderId: 'user-1',
    url: findImage('gallery-photo-1'),
    uploadedAt: '2024-07-20T10:00:00Z',
    matches: [
      { photoId: 'photo-1', userId: 'user-2', confidence: 0.98, isConfirmed: true, faceImageUrl: findImage('avatar-2') },
      { photoId: 'photo-1', userId: 'user-3', confidence: 0.95, isConfirmed: true, faceImageUrl: findImage('avatar-3') },
    ],
  },
  {
    id: 'photo-2',
    eventId: 'event-1',
    uploaderId: 'user-2',
    url: findImage('gallery-photo-2'),
    uploadedAt: '2024-07-20T11:30:00Z',
    matches: [
      { photoId: 'photo-2', userId: 'user-1', confidence: 0.99, isConfirmed: true, faceImageUrl: findImage('avatar-1') },
    ],
  },
  {
    id: 'photo-3',
    eventId: 'event-2',
    uploaderId: 'user-4',
    url: findImage('gallery-photo-3'),
    uploadedAt: '2024-07-21T18:00:00Z',
    matches: [
      { photoId: 'photo-3', userId: 'user-1', confidence: 0.92, isConfirmed: true, faceImageUrl: findImage('avatar-1') },
      { photoId: 'photo-3', userId: 'user-4', confidence: 0.96, isConfirmed: true, faceImageUrl: findImage('avatar-4') },
    ],
  },
  {
    id: 'photo-4',
    eventId: 'event-3',
    uploaderId: 'user-3',
    url: findImage('gallery-photo-4'),
    uploadedAt: '2024-07-22T20:00:00Z',
    matches: [],
  },
  {
    id: 'photo-5',
    eventId: 'event-1',
    uploaderId: 'user-1',
    url: findImage('low-confidence-1'),
    uploadedAt: '2024-07-20T14:00:00Z',
    matches: [
      { photoId: 'photo-5', userId: 'user-1', confidence: 0.65, isConfirmed: false, faceImageUrl: findImage('avatar-1') },
    ],
  },
  {
    id: 'photo-6',
    eventId: 'event-1',
    uploaderId: 'user-2',
    url: findImage('low-confidence-2'),
    uploadedAt: '2024-07-20T15:00:00Z',
    matches: [
        { photoId: 'photo-6', userId: null, confidence: 0.55, isConfirmed: false, faceImageUrl: findImage('avatar-3') },
    ],
  },
];

export const faceMatches: FaceMatch[] = photos.flatMap(p => p.matches);
