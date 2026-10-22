import type { UploadedFile, UploadFile, UploadRequest } from './data-source';
import type { UploadToOptions } from './upload-to';
import { formUploadsPart } from './uploads';

/**
 * A data source's `upload` for a plain endpoint (upload-to.ts): what an app writes once, at once — its work in the files
 * part, which a page with a file field loads before it is drawn, asked for here as the first file goes. A page with no
 * file never downloads it.
 *
 *   upload: uploadTo({ url: '/api/files', headers: { 'X-CSRF-Token': token } })
 */
export function uploadTo(options: UploadToOptions): (file: UploadFile, request: UploadRequest) => Promise<UploadedFile> {
  return (file, request) => formUploadsPart.load().then((part) => part.uploadTo(options)(file, request));
}
