// Patch global.TextDecoder to support utf-16le, which Hermes does not implement.
// This must be imported before any module that calls new TextDecoder('utf-16le').
// The crash source is h3-js: it creates a module-level TextDecoder('utf-16le') decoder
// at import time. React Native URL polyfill does not fix this — only a global patch does.

const OriginalTextDecoder = global.TextDecoder as typeof TextDecoder;

class PatchedTextDecoder {
  private _encoding: string;
  private _inner: TextDecoder | null;

  constructor(encoding?: string, options?: TextDecoderOptions) {
    this._encoding = encoding ?? 'utf-8';
    const normalized = (encoding ?? '').toLowerCase().replace('_', '-');
    if (normalized === 'utf-16le' || normalized === 'utf-16') {
      this._inner = null;
    } else {
      this._inner = new OriginalTextDecoder(encoding, options);
    }
  }

  decode(input?: AllowSharedBufferSource, options?: TextDecodeOptions): string {
    if (this._inner === null) {
      // Manual utf-16le decode — pairs of bytes as little-endian code units
      let bytes: Uint8Array;
      if (input instanceof ArrayBuffer) {
        bytes = new Uint8Array(input);
      } else if (input != null) {
        const view = input as ArrayBufferView;
        bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      } else {
        return '';
      }
      let result = '';
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        result += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
      }
      return result;
    }
    return this._inner.decode(input, options);
  }

  get encoding(): string {
    return this._inner ? this._inner.encoding : this._encoding;
  }

  get fatal(): boolean {
    return this._inner?.fatal ?? false;
  }

  get ignoreBOM(): boolean {
    return this._inner?.ignoreBOM ?? false;
  }
}

// @ts-ignore — intentional global override
global.TextDecoder = PatchedTextDecoder;
