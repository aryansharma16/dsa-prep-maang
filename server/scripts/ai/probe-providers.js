/**
 * Stream one prompt through every configured provider and report what happened.
 *
 * This exists because everything downstream — the failover chain, the model
 * picker, the cooldown classifier — is built on claims about hosts we do not
 * control: that these model ids exist, that they stream, that a dead key fails
 * the way we think it does. Those claims are cheap to check here and expensive
 * to debug once they are three layers under an SSE endpoint.
 *
 * Reports time-to-first-token separately from total time on purpose. TTFT is
 * what a reader actually experiences, and it is the number the default provider
 * was chosen on.
 *
 *   node scripts/ai/probe-providers.js
 *   node scripts/ai/probe-providers.js "what is a segment tree"
 */

import { classify } from '../../src/services/ai/errors.js';
import { PROVIDER_IDS, providerById, resetHealth } from '../../src/services/ai/registry.js';

const PROMPT = process.argv[2] || 'In one sentence, what is a hash map?';

const SYSTEM = 'Answer in one short sentence. No preamble.';

const ms = (start) => Number(process.hrtime.bigint() - start) / 1e6;

async function probe(provider) {
  const label = `${provider.label} (${provider.defaultModel})`;

  if (!provider.configured()) {
    console.log(`  ${'SKIP'.padEnd(6)} ${label} — ${provider.envKey} is not set`);
    return { id: provider.id, skipped: true };
  }

  const started = process.hrtime.bigint();
  let firstTokenAt = null;
  let text = '';
  let usage = null;
  let finish = null;

  // The probe is allowed to take longer than a real request: it is diagnosing
  // slowness, so timing out at the production deadline would hide it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    for await (const event of provider.stream({
      messages: [{ role: 'user', content: PROMPT }],
      system: SYSTEM,
      model: provider.defaultModel,
      maxTokens: 200,
      signal: controller.signal,
    })) {
      if (event.type === 'delta') {
        if (firstTokenAt === null) firstTokenAt = ms(started);
        text += event.text;
      } else if (event.type === 'done') {
        finish = event.finish;
        usage = event.usage;
      }
    }
  } catch (error) {
    const { kind, cooldownMs, message } = classify(error);
    const mins = Math.round(cooldownMs / 60000);
    console.log(`  ${'FAIL'.padEnd(6)} ${label}`);
    console.log(`         ${kind} — ${message}`);
    console.log(`         cooldown ${mins >= 1 ? `${mins}m` : `${Math.round(cooldownMs / 1000)}s`}${error.status ? ` · HTTP ${error.status}` : ''}`);
    if (error.body) console.log(`         ${String(error.body).replace(/\s+/g, ' ').slice(0, 140)}`);
    return { id: provider.id, failed: kind };
  } finally {
    clearTimeout(timer);
  }

  const total = ms(started);
  const out = usage?.out || Math.round(text.length / 4);
  // Tokens per second over the generation window, not the whole request —
  // including the wait for the first token would flatter a slow host.
  const rate = firstTokenAt && total > firstTokenAt ? (out / ((total - firstTokenAt) / 1000)).toFixed(0) : '—';

  console.log(`  ${'OK'.padEnd(6)} ${label}`);
  console.log(`         TTFT ${firstTokenAt === null ? 'never' : `${firstTokenAt.toFixed(0)}ms`} · total ${total.toFixed(0)}ms · ~${rate} tok/s · finish ${finish}`);
  if (usage) console.log(`         tokens in ${usage.in} / out ${usage.out}`);
  console.log(`         ${JSON.stringify(text.trim().slice(0, 120))}`);

  return { id: provider.id, ttft: firstTokenAt, total };
}

async function main() {
  resetHealth();
  console.log(`\n[ai:probe] "${PROMPT}"\n`);

  const results = [];
  for (const id of PROVIDER_IDS) {
    // Sequential, not parallel: these are timing measurements, and four
    // concurrent streams over one uplink would measure the uplink.
    results.push(await probe(providerById(id)));
  }

  const ok = results.filter((r) => r.ttft !== undefined && r.ttft !== null);
  if (ok.length) {
    const fastest = ok.reduce((a, b) => (a.ttft <= b.ttft ? a : b));
    console.log(`\n[ai:probe] fastest to first token: ${fastest.id} (${fastest.ttft.toFixed(0)}ms)`);
  }

  const failed = results.filter((r) => r.failed);
  if (failed.length) console.log(`[ai:probe] unavailable: ${failed.map((r) => `${r.id} (${r.failed})`).join(', ')}`);
  const skipped = results.filter((r) => r.skipped);
  if (skipped.length) console.log(`[ai:probe] not configured: ${skipped.map((r) => r.id).join(', ')}`);
  console.log('');

  if (!ok.length) {
    console.error('[ai:probe] no provider answered — chat would be unavailable on this deployment.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ai:probe]', error);
  process.exit(1);
});
