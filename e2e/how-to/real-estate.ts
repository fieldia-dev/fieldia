import type { Replays } from './hand';
import { replay as homesGallery } from './real-estate/homes-gallery';
import { replay as homesSearch } from './real-estate/homes-search';
import { replay as property } from './real-estate/property';
import { replay as listing } from './real-estate/listing';
import { replay as enquiry } from './real-estate/enquiry';
import { replay as listingLanguages } from './real-estate/listing-languages';
import { replay as lease } from './real-estate/lease';
import { replay as enquiryReply } from './real-estate/enquiry-reply';
import { replay as unitEnquiry } from './real-estate/unit-enquiry';
import { replay as viewingReport } from './real-estate/viewing-report';

/** The real-estate demos' how-to steps up to the viewing report (the catalogue's order), replayed by hand (e2e/how-to.spec.ts); the rest are in real-estate-more.ts. */
export const realEstate: Replays = {
  'homes-gallery': homesGallery,
  'homes-search': homesSearch,
  property,
  listing,
  enquiry,
  'listing-languages': listingLanguages,
  lease,
  'enquiry-reply': enquiryReply,
  'unit-enquiry': unitEnquiry,
  'viewing-report': viewingReport,
};
