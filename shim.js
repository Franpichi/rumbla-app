// shim.js — runs before the main bundle via metro getModulesRunBeforeMainModule.
// Hermes has a native TextDecoder but it does NOT support utf-16le.
// @supabase/supabase-js (via jose) calls new TextDecoder('utf-16le') during JWT parsing.
// We monkey-patch global.TextDecoder to handle utf-16le manually and delegate
// everything else to the original native implementation.
// NOTE: text-encoding-polyfill is intentionally NOT imported here — it accesses
// globals (FormData etc.) that are not yet available during the shim phase,
// causing [runtime not ready] errors. Hermes has TextEncoder/TextDecoder natively.

(function patchTextDecoder() {
  var OriginalDecoder = global.TextDecoder;
  if (!OriginalDecoder) return;

  function decodeUtf16le(input) {
    var bytes;
    if (input instanceof Uint8Array) {
      bytes = input;
    } else if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    } else if (input && input.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength);
    } else {
      return '';
    }
    var str = '';
    for (var i = 0; i + 1 < bytes.length; i += 2) {
      str += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    }
    return str;
  }

  function PatchedTextDecoder(encoding, options) {
    var enc = (encoding || 'utf-8').toLowerCase().replace(/_/g, '-');
    this._utf16le = enc === 'utf-16le' || enc === 'utf-16';
    this.fatal = !!(options && options.fatal);
    this.ignoreBOM = !!(options && options.ignoreBOM);
    if (this._utf16le) {
      this.encoding = 'utf-16le';
    } else {
      this._inner = new OriginalDecoder(encoding, options);
      this.encoding = this._inner.encoding;
    }
  }

  PatchedTextDecoder.prototype.decode = function (input, options) {
    if (this._utf16le) return decodeUtf16le(input);
    return this._inner.decode(input, options);
  };

  global.TextDecoder = PatchedTextDecoder;
})();
