import { Codec } from './codec';
import { isWrappedType } from './types';

export class Decoder {
  constructor(private readonly codecs: Map<string, Codec>) {}

  decode(value: unknown): unknown {
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
        return value;
    }

    if (value === null) {
      return null;
    }

    if (isWrappedType(value)) {
      const codec = this.codecs.get(value.$);

      if (!codec) {
        throw new TypeError(
          `An incoming value was encoded with a codec ${value.$} that hasn't been registered locally. Did you forget to call addCodec?`
        );
      }

      return codec.decode(value);
    }

    // if (Array.isArray(value)) {
    //   return value.map(arg => this.decode(arg));
    // }

    // if (typeof value === 'object') {
    //   const mappedArg = {} as any;

    //   for (const property in value) {
    //     mappedArg[property] = this.decode((value as any)[property]);
    //   }

    //   return mappedArg;
    // }

    return value;
  }
}
