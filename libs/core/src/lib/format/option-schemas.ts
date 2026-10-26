import type * as z from 'zod';
import type { OptionShape } from './rules';
import { CheckTreeOptionsSchema, PathPickerOptionsSchema, PickerOptionsSchema, StateDotOptionsSchema } from './picker-options';
import { PhoneOptionsSchema } from './phone';
import { SlotsOptionsSchema } from './slots-options';
import { SignatureOptionsSchema } from './signature-options';
import { PhotosOptionsSchema } from './photos-options';
import { ScanOptionSchema, ScanSettingsSchema } from './scan-options';
import { MaskOptionsSchema, OneTimeCodeOptionsSchema, ShorthandOptionsSchema } from './typed-options';
import { CodeOptionsSchema, PinsOptionsSchema, RecordOptionsSchema } from './media-options';
import { PageLoadingSchema } from './loading-schema';
import { AddressSearchOptionsSchema } from './address-search';

/**
 * The schemas of a widget's own options, by the names the rules check parts against (rules.ts `RuleContext.check`):
 * what `validatePage` checks a field's `options` with, and — made the format's schema as the viewer reads it
 * (page-shape.spec.ts) — what the viewer checks them with.
 */
export const OPTION_SCHEMAS: Record<OptionShape, z.ZodType> = {
  PickerOptions: PickerOptionsSchema,
  PathPickerOptions: PathPickerOptionsSchema,
  StateDotOptions: StateDotOptionsSchema,
  CheckTreeOptions: CheckTreeOptionsSchema,
  PhoneOptions: PhoneOptionsSchema,
  SlotsOptions: SlotsOptionsSchema,
  SignatureOptions: SignatureOptionsSchema,
  PhotosOptions: PhotosOptionsSchema,
  ScanSettings: ScanSettingsSchema,
  ScanOption: ScanOptionSchema,
  OneTimeCodeOptions: OneTimeCodeOptionsSchema,
  MaskOptions: MaskOptionsSchema,
  ShorthandOptions: ShorthandOptionsSchema,
  RecordOptions: RecordOptionsSchema,
  CodeOptions: CodeOptionsSchema,
  PinsOptions: PinsOptionsSchema,
  PageLoading: PageLoadingSchema,
  AddressSearchOptions: AddressSearchOptionsSchema,
};
