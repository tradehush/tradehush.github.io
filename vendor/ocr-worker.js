// Artifact hosting serves only standard web types, so the gzipped language files are published
// with a .wasm suffix; this wrapper points tesseract's worker-side fetch at them.
const nativeFetch = self.fetch.bind(self);
self.fetch = (url, opts) => nativeFetch(typeof url === "string" && /\.traineddata\.gz$/.test(url) ? url + ".wasm" : url, opts);
importScripts("worker.min.js");
