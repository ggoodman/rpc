import { Codec } from './codec';
import { isWrappedType, isWrappedTypeOfKind } from './messages';
import { SendMessageFunction } from './transport';

export class Decoder {
  constructor(private readonly codecs: Map<string, Codec>) {}

  decode(value: unknown, ctx: { sendMessage: SendMessageFunction }): unknown {
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
        return value;
    }

    if (value === null) {
      return null;
    }

    if (isWrappedTypeOfKind(value, 'u')) {
      return undefined;
    }

    if (isWrappedType(value)) {
      const codec = this.codecs.get(value.$);

      if (!codec) {
        throw new TypeError(
          `An incoming value was encoded with a codec ${value.$} that hasn't been registered locally. Did you forget to call addCodec?`
        );
      }

      return codec.decode(value, ctx);
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
