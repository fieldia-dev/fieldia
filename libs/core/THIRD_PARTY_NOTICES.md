# Third-party notices

@fieldia/core is MIT licensed (see LICENSE). One of its files carries another
project's code.

## zod

**What:** `@fieldia/core/schema` — the page format's schemas and its whole check
(`validatePage`), as `src/lib/format/schema-part.bundle.mjs`, the file its ESM
import names — carries zod inside, bundled from the zod release the package
depends on (`"zod": "^4.6.5"`) by `tools/dual-build.mjs` in Fieldia's
repository, so a bundler gives it a chunk of its own (0.35). Everywhere else
@fieldia/core imports zod as the dependency npm installs beside it.

**Where from:** <https://github.com/colinhacks/zod>.

**Licence:** zod is

    MIT License

    Copyright (c) 2025 Colin McDonnell

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
