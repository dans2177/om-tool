/**
 * Next.js instrumentation – runs once at server startup.
 * Installs DOM polyfills as early as possible (belt-and-suspenders alongside
 * the dynamic-import approach used in individual route handlers).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensurePolyfills } = await import('@/lib/ensurePolyfills');
    ensurePolyfills();
    console.log('✅ DOM polyfills installed for serverless runtime');
  }
}
