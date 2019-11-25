import { Codec } from './codec';

export class Encoder {
  constructor(private readonly codecs: Map<string, Codec>) {}

  encode(value: unknown): unknown {
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

    for (const codec of this.codecs.values()) {
      if (codec.canEncode(value)) {
        return codec.encode(value);
      }
    }

    // if (Array.isArray(value)) {
    //   return value.map(arg => this.encode(arg));
    // }

    // if (typeof value === 'object') {
    //   const mappedArg = {} as any;

    //   for (const property in value) {
    //     mappedArg[property] = this.encode((value as any)[property]);
    //   }

    //   return mappedArg;
    // }

    return value;
  }
}
