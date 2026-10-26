import type { Replays } from './hand';
import { replay as fields } from './building-blocks/fields';
import { replay as business } from './building-blocks/business';
import { replay as code } from './building-blocks/code';
import { replay as delivery } from './building-blocks/delivery';
import { replay as lists } from './building-blocks/lists';
import { replay as mapDelivery } from './building-blocks/map-delivery';
import { replay as mapAddress } from './building-blocks/map-address';
import { replay as mapZone } from './building-blocks/map-zone';
import { replay as mapHomesArabic } from './building-blocks/map-homes-arabic';
import { replay as bookingWeekArabic } from './building-blocks/booking-week-arabic';
import { replay as custom } from './building-blocks/custom';
import { replay as contained } from './building-blocks/contained';
import { replay as twoTabs } from './building-blocks/two-tabs';
import { replay as viewerRole } from './building-blocks/viewer-role';
import { replay as customerLocked } from './building-blocks/customer-locked';
import { replay as customersArabic } from './building-blocks/customers-arabic';
import { replay as customerArabic } from './building-blocks/customer-arabic';
import { replay as signupFrench } from './building-blocks/signup-french';
import { replay as signupKeys } from './building-blocks/signup-keys';
import { replay as customerToast } from './building-blocks/customer-toast';
import { replay as script } from './building-blocks/script';
import { replay as csp } from './building-blocks/csp';
import { replay as designerScreen } from './building-blocks/designer-screen';

/** The building-blocks demos' how-to steps, replayed by hand (e2e/how-to.spec.ts): one file each, in building-blocks/. */
export const buildingBlocks: Replays = {
  fields,
  business,
  code,
  delivery,
  lists,
  'map-delivery': mapDelivery,
  'map-address': mapAddress,
  'map-zone': mapZone,
  'map-homes-arabic': mapHomesArabic,
  'booking-week-arabic': bookingWeekArabic,
  custom,
  contained,
  'two-tabs': twoTabs,
  'viewer-role': viewerRole,
  'customer-locked': customerLocked,
  'customers-arabic': customersArabic,
  'customer-arabic': customerArabic,
  'signup-french': signupFrench,
  'signup-keys': signupKeys,
  'customer-toast': customerToast,
  script,
  csp,
  'designer-screen': designerScreen,
};
