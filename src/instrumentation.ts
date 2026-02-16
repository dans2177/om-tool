/**
 * Next.js instrumentation – runs once at server startup, BEFORE any route
 * handlers are loaded.  We polyfill the three DOM globals that pdfjs-dist
 * expects so it stops crashing in Vercel's serverless Node runtime (which
 * doesn't bundle @napi-rs/canvas).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    /* ------------------------------------------------------------------ */
    /*  DOMMatrix polyfill                                                 */
    /* ------------------------------------------------------------------ */
    if (typeof globalThis.DOMMatrix === 'undefined') {
      class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        m11 = 1; m12 = 0; m13 = 0; m14 = 0;
        m21 = 0; m22 = 1; m23 = 0; m24 = 0;
        m31 = 0; m32 = 0; m33 = 1; m34 = 0;
        m41 = 0; m42 = 0; m43 = 0; m44 = 1;
        is2D = true;
        isIdentity = true;

        constructor(init?: string | number[]) {
          if (Array.isArray(init) && init.length === 6) {
            [this.a, this.b, this.c, this.d, this.e, this.f] = init;
            this.m11 = this.a; this.m12 = this.b;
            this.m21 = this.c; this.m22 = this.d;
            this.m41 = this.e; this.m42 = this.f;
          }
        }

        inverse() { return new DOMMatrix(); }
        multiply(_other?: any) { return new DOMMatrix(); }
        translate(_tx?: number, _ty?: number, _tz?: number) { return new DOMMatrix(); }
        scale(_sx?: number, _sy?: number, _sz?: number) { return new DOMMatrix(); }
        rotate(_angle?: number) { return new DOMMatrix(); }
        rotateSelf(_angle?: number) { return this; }
        scaleSelf(_sx?: number, _sy?: number) { return this; }
        translateSelf(_tx?: number, _ty?: number) { return this; }
        multiplySelf(_other?: any) { return this; }
        invertSelf() { return this; }
        transformPoint(_point?: any) { return { x: 0, y: 0, z: 0, w: 1 }; }
        toFloat32Array() { return new Float32Array(16); }
        toFloat64Array() { return new Float64Array(16); }
        toString() {
          return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
        }

        static fromMatrix(_other?: any) { return new DOMMatrix(); }
        static fromFloat32Array(_arr: Float32Array) { return new DOMMatrix(); }
        static fromFloat64Array(_arr: Float64Array) { return new DOMMatrix(); }
      }
      (globalThis as any).DOMMatrix = DOMMatrix;
    }

    /* ------------------------------------------------------------------ */
    /*  ImageData polyfill                                                 */
    /* ------------------------------------------------------------------ */
    if (typeof globalThis.ImageData === 'undefined') {
      class ImageData {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        colorSpace = 'srgb';

        constructor(
          swOrData: number | Uint8ClampedArray,
          sh: number,
          shOrSettings?: number | Record<string, unknown>,
        ) {
          if (swOrData instanceof Uint8ClampedArray) {
            this.data = swOrData;
            this.width = sh;
            this.height =
              typeof shOrSettings === 'number'
                ? shOrSettings
                : swOrData.length / (sh * 4);
          } else {
            this.width = swOrData;
            this.height = sh;
            this.data = new Uint8ClampedArray(swOrData * sh * 4);
          }
        }
      }
      (globalThis as any).ImageData = ImageData;
    }

    /* ------------------------------------------------------------------ */
    /*  Path2D polyfill (stub – only needed so pdfjs-dist loads)           */
    /* ------------------------------------------------------------------ */
    if (typeof globalThis.Path2D === 'undefined') {
      class Path2D {
        constructor(_d?: string | Path2D) {}
        addPath(_path: Path2D, _transform?: any) {}
        arc() {}
        arcTo() {}
        bezierCurveTo() {}
        closePath() {}
        ellipse() {}
        lineTo() {}
        moveTo() {}
        quadraticCurveTo() {}
        rect() {}
        roundRect() {}
      }
      (globalThis as any).Path2D = Path2D;
    }

    console.log('✅ DOM polyfills installed for serverless runtime');
  }
}
