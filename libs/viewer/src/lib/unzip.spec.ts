import { DecompressionStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { deflateRawSync } from 'node:zlib';
import { unzip, UNZIPPED_MOST, ZipProblem } from './unzip';

/**
 * A workbook's archive opened as the import opens it: each file to the size the archive says it is — one that opens to
 * another is damaged, stopped where it went past it — and none, nor all of them read, past `UNZIPPED_MOST` (S-M3).
 */
beforeAll(() => Object.assign(globalThis, { DecompressionStream, TextDecoder, TextEncoder }));

/** An archive of one file, `plain` deflated, its directory saying it opens to `said` bytes. */
function archive(plain: Uint8Array, said: number, path = 'xl/sharedStrings.xml', stored = false): Uint8Array {
  const body = stored ? plain : deflateRawSync(plain, { level: 9 });
  const name = Buffer.from(path);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(stored ? 0 : 8, 8);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(said, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(stored ? 0 : 8, 10);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(said, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(30 + name.length + body.length, 16);
  return new Uint8Array(Buffer.concat([local, name, body, central, name, end]));
}

const refusal = (reading: Promise<unknown>) => reading.then(() => null, (error: unknown) => (error instanceof ZipProblem ? error.problem : String(error)));

describe('a workbook’s archive opened, never past what it says nor past the most (S-M3)', () => {
  it('stops a file that says it opens to nothing at once: 100 KB squeezed from 100 MB of one letter (the audit’s proof)', async () => {
    const bomb = archive(new Uint8Array(100 * 1024 * 1024).fill(0x61), 0);
    expect(bomb.length).toBeLessThan(200 * 1024);
    const start = performance.now();
    expect(await refusal(unzip(bomb).read('xl/sharedStrings.xml'))).toBe('damaged');
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('refuses a file saying it opens to more than the most, before opening it, and one that opens to another size', async () => {
    expect(await refusal(unzip(archive(new Uint8Array(10), UNZIPPED_MOST.entry + 1)).read('xl/sharedStrings.xml'))).toBe('tooLarge');
    expect(await refusal(unzip(archive(new Uint8Array(10).fill(0x61), 9)).read('xl/sharedStrings.xml'))).toBe('damaged');
    expect(await refusal(unzip(archive(new Uint8Array(10).fill(0x61), 11)).read('xl/sharedStrings.xml'))).toBe('damaged');
    expect(await refusal(unzip(archive(new Uint8Array(10).fill(0x61), 12, 'xl/a.xml', true)).read('xl/a.xml'))).toBe('damaged');
  });

  it('opens a file that is the size it says', async () => {
    const plain = new TextEncoder().encode('<sst><si><t>Mona</t></si></sst>');
    expect(new TextDecoder().decode((await unzip(archive(plain, plain.length)).read('xl/sharedStrings.xml')) as Uint8Array)).toBe('<sst><si><t>Mona</t></si></sst>');
    expect(new TextDecoder().decode((await unzip(archive(plain, plain.length, 'xl/a.xml', true)).read('xl/a.xml')) as Uint8Array)).toBe('<sst><si><t>Mona</t></si></sst>');
  });
});
