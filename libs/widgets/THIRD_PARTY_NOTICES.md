# Third-party notices

@fieldia/widgets is MIT licensed (see LICENSE). It carries one piece of data
made from another project's work.

## libphonenumber's metadata

**What:** the phone part's table of countries — each country's dialling code,
the digit a number is dialled with at home, the lengths its numbers have by how
they start, and how they are written in groups —
`src/lib/phone-table.js` (`phone-table.ts` in the source), and so the phone
part, `fieldia.phone.js`, in @fieldia/viewer's script bundle.

**Where from:** derived from libphonenumber's phone number metadata
(`PhoneNumberMetadata.xml`), <https://github.com/google/libphonenumber>, as the
libphonenumber-js package ships it in JSON (`metadata.max.json`, version 1.12),
<https://gitlab.com/catamphetamine/libphonenumber-js>, by
`tools/phone-table.mjs` in Fieldia's repository. The table keeps a part of the
metadata, rewritten in a shorter form of its own; it is no copy of either
project's code.

**Licence:** the metadata is

    Copyright (C) 2009 The Libphonenumber Authors

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

The table is a work derived from it: Fieldia changed its form (what is kept,
and how it is written), not what it says of any country's numbers.

libphonenumber-js, through which the metadata was read, is

    Copyright (c) 2016 @catamphetamine

and MIT licensed: <https://gitlab.com/catamphetamine/libphonenumber-js/-/blob/master/LICENSE>.
