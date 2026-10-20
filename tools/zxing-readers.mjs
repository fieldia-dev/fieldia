/**
 * What the one-tag script's decode part (fieldia.decode.js) takes as `@zxing/library`: the readers it uses alone, from
 * the library's own modules (tools/script-bundle.mjs). The library's index brings every reader it has — PDF417, Aztec,
 * MaxiCode, RSS, Code 93, ITF, Codabar — whose modules a bundler cannot leave out (each a class made by a function
 * call): 459 KB where these are 155. An app's bundler takes the index as libs/widgets/src/lib/decode-part.ts imports it.
 *
 * Its 1D reader is ZXing's MultiFormatOneDReader for the formats Fieldia reads: the UPC and EAN family, Code 39 and
 * Code 128, tried in that order, as the library's tries them.
 */
import BarcodeFormat from '@zxing/library/esm/core/BarcodeFormat';
import BinaryBitmap from '@zxing/library/esm/core/BinaryBitmap';
import DecodeHintType from '@zxing/library/esm/core/DecodeHintType';
import NotFoundException from '@zxing/library/esm/core/NotFoundException';
import RGBLuminanceSource from '@zxing/library/esm/core/RGBLuminanceSource';
import HybridBinarizer from '@zxing/library/esm/core/common/HybridBinarizer';
import DataMatrixReader from '@zxing/library/esm/core/datamatrix/DataMatrixReader';
import Code128Reader from '@zxing/library/esm/core/oned/Code128Reader';
import Code39Reader from '@zxing/library/esm/core/oned/Code39Reader';
import MultiFormatUPCEANReader from '@zxing/library/esm/core/oned/MultiFormatUPCEANReader';
import OneDReader from '@zxing/library/esm/core/oned/OneDReader';
import QRCodeReader from '@zxing/library/esm/core/qrcode/QRCodeReader';

/** The UPC and EAN family, Code 39 and Code 128, of those the hints name. */
class MultiFormatOneDReader extends OneDReader {
  constructor(hints) {
    super();
    const formats = hints?.get(DecodeHintType.POSSIBLE_FORMATS) ?? [];
    this.readers = [];
    if ([BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E].some((format) => formats.includes(format))) this.readers.push(new MultiFormatUPCEANReader(hints));
    if (formats.includes(BarcodeFormat.CODE_39)) this.readers.push(new Code39Reader());
    if (formats.includes(BarcodeFormat.CODE_128)) this.readers.push(new Code128Reader());
  }
  decodeRow(rowNumber, row, hints) {
    for (const reader of this.readers) {
      try {
        return reader.decodeRow(rowNumber, row, hints);
      } catch {
        // Not this format: the next looks.
      }
    }
    throw new NotFoundException();
  }
  reset() {
    for (const reader of this.readers) reader.reset();
  }
}

export { BarcodeFormat, BinaryBitmap, DataMatrixReader, DecodeHintType, HybridBinarizer, MultiFormatOneDReader, QRCodeReader, RGBLuminanceSource };
