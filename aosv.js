/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Like `isNaN` but returns `true` for symbols.
function betterIsNaN(s) {
  if (typeof s === "symbol") {
    return true;
  }
  return isNaN(s);
}

export function ArrayOfStructsView(buffer, descriptors) {
  const dataView = new DataView(buffer);
  // Accumulate the size of one struct
  let stride = 0;
  // Copy
  descriptors = Object.assign({}, descriptors);
  for (const [name, descriptor] of Object.entries(descriptors)) {
    // Copy second layer and add offset property
    descriptors[name] = Object.assign({}, descriptor, { offset: stride });
    stride += descriptor.size;
  }

  const length = Math.floor(buffer.byteLength / stride);
  return new Proxy(new Array(length), {
    get(target, prop, proxy) {
      switch (prop) {
        case "buffer":
          return buffer;
        case "toJSON":
          return JSON.stringify(Array.from({ length }, (_, i) => proxy[i]));
        case "length":
          return length;
      }
      // If it wasn’t handled by the switch-case above
      // and is not a number, than it’s a prop we don’t support yet.
      if (betterIsNaN(prop)) {
        throw Error(`Accessing "${prop}" is unsupported for now lol`);
      }
      const idx = parseInt(prop);
      const itemOffset = idx * stride;
      if (!target[idx]) {
        target[idx] = {};
        for (const [name, descriptor] of Object.entries(descriptors)) {
          if (!("get" in descriptor)) {
            continue;
          }
          Object.defineProperty(target[idx], name, {
            enumerable: true,
            get() {
              return descriptor.get(dataView, itemOffset + descriptor.offset);
            },
            set(value) {
              return descriptor.set(
                dataView,
                itemOffset + descriptor.offset,
                value
              );
            }
          });
        }
      }
      return target[idx];
    }
  });
}

[
  "Uint16",
  "Uint32",
  "Int16",
  "Int32",
  "Float32",
  "Float64",
  "BigInt64",
  "BigUint64"
].forEach(name => {
  ArrayOfStructsView[name] = ({ endianess = "big" } = {}) => {
    if (endianess !== "big" && endianess !== "little") {
      throw Error("Endianess needs to be either 'big' or 'little'");
    }
    const littleEndian = endianess === "little";
    return {
      size: self[`${name}Array`].BYTES_PER_ELEMENT,
      get: (dataView, byteOffset) =>
        dataView[`get${name}`](byteOffset, littleEndian),
      set: (dataView, byteOffset, value) =>
        dataView[`set${name}`](byteOffset, value, littleEndian)
    };
  };
});

ArrayOfStructsView.Uint8 = () => ({
  size: 1,
  get: (dataView, byteOffset) => dataView.getUint8(byteOffset),
  set: (dataView, byteOffset, value) => dataView.setUint8(byteOffset, value)
});

ArrayOfStructsView.reserved = size => ({ size });

export default ArrayOfStructsView;
