import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'An agent is a loop: **the model decides what to do, a tool does it, the result goes back in, repeat.** As a system design problem that one sentence is the whole difficulty — because *the model decides how many iterations*, and therefore how long it takes and how much it costs.',
    ),

    h('The loop'),
    diagram(
      `
   ┌──────────────────────────────────────────────┐
   │                                              │
   ▼                                              │
   model  ──▶ "call search_orders(user=42)"       │
                      │                           │
                      ▼                           │
                 tool executes                    │
                      │                           │
                      ▼                           │
              result appended to context ─────────┘
                      │
                      ▼  no more tool calls
                 final answer

   EVERY iteration is a full inference call, with a context
   that keeps GROWING.

   10 iterations ≈ 10 inference calls
                 ≈ 10-60 seconds
                 ≈ 10-50x the cost of one call

   and the model chooses the number. unbounded, by default.
`,
      'Why cost and latency are the design problem',
    ),
    warn(
      'The default failure is **an agent looping forever**: it calls a tool, misreads the result, calls it again, and repeats until something external stops it. Every iteration costs money and the loop produces no error — so hard limits are a correctness requirement, not a safeguard.',
    ),

    h('The limits that must exist'),
    table(
      ['Limit', 'Why', 'Typical'],
      [
        ['**Max iterations**', 'Stops infinite loops', '5–20, task-dependent'],
        ['**Token budget per task**', 'Caps cost even within the iteration limit', 'A hard number'],
        ['**Wall-clock deadline**', 'The user will not wait forever', '30–120 s'],
        ['**Per-tool call limit**', 'Stops one tool being hammered', '3–5 per tool'],
        ['**Repeat detection**', 'The same call with the same arguments is a loop', 'Detect and break'],
        ['**Cost ceiling per tenant**', 'One user cannot spend the budget', 'A daily cap'],
      ],
    ),
    code(
      js(`
async function runAgent(task, ctx) {
  const budget = { iterations: 12, tokens: 100_000, deadline: Date.now() + 90_000 };
  const seen = new Set();

  while (budget.iterations-- > 0) {
    if (Date.now() > budget.deadline) return partial('deadline');
    if (budget.tokens <= 0) return partial('budget');

    const step = await model.next(ctx);
    budget.tokens -= step.usage.total;

    if (!step.toolCall) return step.answer;

    // A repeated identical call means the model is not making
    // progress. Breaking out is better than burning the budget
    // discovering that the twelfth attempt also fails.
    const key = \`\${step.toolCall.name}:\${JSON.stringify(step.toolCall.args)}\`;
    if (seen.has(key)) return partial('loop detected');
    seen.add(key);

    // Tools are the blast radius. Each one is permission-checked
    // against the acting USER, never the agent's own identity.
    ctx.push(await tools.run(step.toolCall, { actingAs: ctx.user }));
  }
  return partial('max iterations');
}
`),
    ),
    tip(
      'Returning a **partial result** with a reason beats returning nothing. "I found three of the five, then ran out of time" is useful; a timeout error after ninety seconds and a dollar of inference is not.',
    ),

    h('Tools are the blast radius'),
    warn(
      'A tool is **an API call the model chose to make.** If a tool can delete records, send emails or move money, then a prompt injection in a document the agent read can do those things. The model is not a trust boundary and must never be treated as one.',
    ),
    table(
      ['Control', 'How'],
      [
        ['**Permission-check as the user**', 'Every tool call authorised against the human, not the agent'],
        ['**Read-only by default**', 'Writes are opt-in, per tool, per context'],
        ['**Human approval for irreversible actions**', 'Payments, deletions, external messages'],
        ['**Idempotency keys**', 'A retried agent step must not act twice'],
        ['**Rate and spend limits per tool**', 'Bounds a runaway loop\'s real-world effect'],
        ['**Audit every call**', 'With arguments, result and the trace id'],
      ],
    ),

    h('Where state lives'),
    flow(['Conversation', 'Working memory', 'Long-term store', 'Checkpoints'], 'Four different lifetimes'),
    table(
      ['State', 'Lives in', 'Lifetime'],
      [
        ['**Conversation**', 'A durable store, keyed by session', 'The session'],
        ['**Working context**', 'The prompt itself', 'One task — and it is bounded'],
        ['**Long-term memory**', 'A vector store or database, retrieved as needed', 'Indefinite'],
        ['**Checkpoints**', 'A durable store, per step', 'Until the task completes'],
      ],
    ),
    p(
      'Context is finite, so a long-running agent must **summarise or offload**: compress older turns, keep the recent ones verbatim, and retrieve older detail only when needed. An agent whose context grows without bound eventually fails, and it fails at the end of a long expensive task.',
    ),
    tip(
      'Checkpoint after each step. A twelve-step task that fails at step eleven should **resume from ten**, not restart — otherwise a transient tool failure costs the entire budget spent so far.',
    ),

    h('Single agent or many'),
    table(
      ['Pattern', 'Good for', 'Cost'],
      [
        ['**One agent, many tools**', '**Most tasks.** Start here', 'Simplest; a large tool list can confuse the model'],
        ['**Router + specialists**', 'Clearly distinct domains', 'One extra hop'],
        ['**Orchestrator + workers**', 'Parallelisable subtasks', 'Coordination, and much higher cost'],
        ['**Peer agents**', 'Rarely justified', '**Cost and latency multiply; debugging is very hard**'],
      ],
    ),
    warn(
      'Multi-agent architectures multiply **cost, latency and failure modes** and are reached for far too early. A single agent with well-described tools solves most problems; add a second only when a specific limitation is demonstrated, not anticipated.',
    ),

    h('Observability'),
    table(
      ['Record per task', 'Why'],
      [
        ['Every step: prompt, tool call, result', 'The only way to debug a wrong outcome'],
        ['**Iteration count distribution**', 'A rising tail means the tools or prompts have degraded'],
        ['**Cost per task**', 'The number that decides whether the feature is viable'],
        ['Tool success and latency', 'One flaky tool causes retry loops'],
        ['Termination reason', 'Answered, deadline, budget, loop, error'],
        ['Human corrections', 'The quality signal that matters'],
      ],
    ),
    tip(
      'Track the **distribution** of iterations, not the average. A median of three and a p99 of twenty means most tasks are fine and a tail is burning the budget — and that tail is where both the cost and the quality problems live.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A loop where a model chooses tool calls until it can answer'],
      ['The hard part', 'The model decides the iteration count, so cost and latency are unbounded'],
      ['Use when', 'A task needs several steps whose sequence is not known in advance'],
      ['Trade-off', 'Flexibility, against unbounded cost, latency and a real blast radius'],
      [
        '30-second answer',
        '"An agent is a loop — the model picks a tool, the tool runs, the result returns to context. Each iteration is a full inference with a growing context and the model chooses how many, so hard limits are mandatory: max iterations, a token budget, a deadline and repeat detection, returning a partial result rather than nothing. Tools are the blast radius, so every call is permission-checked as the human user and writes are opt-in. Checkpoint each step so a failure resumes."',
      ],
    ]),
    asked([
      ['How do you stop an agent running up an unbounded bill?', 'Max iterations, a token budget, a wall-clock deadline, repeat detection, and a per-tenant spend cap.'],
      ['Where does state live?', 'Conversation in a durable store, working context in the prompt, long-term memory retrieved, and per-step checkpoints.'],
      ['What is the main security concern?', 'Tools. A prompt injection can trigger any action a tool allows, so authorise as the user and keep writes opt-in.'],
      ['Single agent or multi-agent?', 'Single with good tools for most tasks. Multi-agent multiplies cost, latency and debugging difficulty.'],
      ['What do you monitor?', 'Iteration distribution, cost per task, tool success rates, and termination reasons — not just errors.'],
    ]),

    links(
      wiki('Intelligent_agent', 'Intelligent agent'),
      wiki('Prompt_injection', 'Prompt injection'),
    ),
  ],
};
