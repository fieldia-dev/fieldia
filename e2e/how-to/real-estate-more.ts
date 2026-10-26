import type { Replays } from './hand';
import { replay as mapHomes } from './real-estate/map-homes';
import { replay as mapManyHomes } from './real-estate/map-many-homes';
import { replay as mapEmbed } from './real-estate/map-embed';
import { replay as listingPhotos } from './real-estate/listing-photos';
import { replay as listingPhotoSet } from './real-estate/listing-photo-set';
import { replay as bookingWeek } from './real-estate/booking-week';
import { replay as templatePropertyEnquiry } from './real-estate/template-property-enquiry';
import { replay as findAHome } from './real-estate/find-a-home';
import { replay as siteVisit } from './real-estate/site-visit';
import { replay as embed } from './real-estate/embed';

/** The real-estate demos’ how-to steps from the maps’ to the embed’s (the catalogue’s order), replayed by hand (e2e/how-to.spec.ts): each demo’s in e2e/how-to/real-estate/<demo id>.ts; the rest are in real-estate.ts. */
export const realEstateMore: Replays = {
  'map-homes': mapHomes,
  'map-many-homes': mapManyHomes,
  'map-embed': mapEmbed,
  'listing-photos': listingPhotos,
  'listing-photo-set': listingPhotoSet,
  'booking-week': bookingWeek,
  'template-property-enquiry': templatePropertyEnquiry,
  'find-a-home': findAHome,
  'site-visit': siteVisit,
  embed,
};
