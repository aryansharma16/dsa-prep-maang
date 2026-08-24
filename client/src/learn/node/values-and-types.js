import { asked, cheat, code, h, js, links, mdn, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'JavaScript has seven primitive types and one everything-else type. That single split — primitive or object — decides how a value is copied, how it is compared, and how it behaves when you pass it to a function. Almost every "why did that change?" bug in a Node service traces back to it.',
    ),

    h('The types'),
    table(
      ['Type', 'Example', 'Notes'],
      [
        ['`string`', "`'hello'`", 'Immutable. Every "modification" returns a new string.'],
        ['`number`', '`42`, `3.14`, `NaN`, `Infinity`', 'One numeric type, a 64-bit float. There is no int.'],
        ['`boolean`', '`true`', ''],
        ['`undefined`', '`undefined`', 'A variable that exists but was never given a value.'],
        ['`null`', '`null`', 'A value you deliberately set to "nothing".'],
        ['`bigint`', '`9007199254740993n`', 'Integers beyond `Number.MAX_SAFE_INTEGER`. Common with database IDs.'],
        ['`symbol`', '`Symbol("id")`', 'A unique key. Rare in application code.'],
        ['`object`', '`{}`, `[]`, `function(){}`, `new Date()`', 'Everything else. Arrays and functions are objects.'],
      ],
    ),
    code(
      js(`
// run: node types.js
console.log(typeof 'hi');        // 'string'
console.log(typeof 42);          // 'number'
console.log(typeof undefined);   // 'undefined'
console.log(typeof null);        // 'object'   <- a 1995 bug, kept forever
console.log(typeof []);          // 'object'
console.log(typeof function(){});// 'function' <- the one object that is special-cased
`),
    ),
    tip(
      'To tell an array from an object, `typeof` is useless. Use `Array.isArray(value)`. To tell `null` from an object, check `value === null` first.',
    ),

    h('Primitives copy, objects share'),
    p(
      'Assigning a primitive copies the value. Assigning an object copies the *reference* — the address, not the thing. Both variables now point at one object, and either can change it.',
    ),
    code(
      js(`
let a = 1;
let b = a;
b = 2;
console.log(a);              // 1  — untouched

const user = { name: 'Ada' };
const alias = user;
alias.name = 'Grace';
console.log(user.name);      // 'Grace'  — same object
console.log(user === alias); // true
`),
    ),
    warn(
      'This is what makes a function feel like it "mutated my argument". It did — you handed it a reference. Passing `{ ...user }` hands it a copy of the top level instead, which is usually what you meant.',
    ),
    p(
      '`const` does not help here. `const` freezes the *binding*, not the value: you cannot point `user` at a different object, but you can change every property inside the one it points at.',
    ),
    code(
      js(`
const user = { name: 'Ada' };
user.name = 'Grace';   // fine — the object is mutable
user = {};             // TypeError: Assignment to constant variable
`),
    ),

    h('Equality'),
    p(
      '`===` compares without converting types. `==` converts first, using a coercion table almost nobody has memorised. Use `===` everywhere, with exactly one useful exception.',
    ),
    code(
      js(`
0 === '0';        // false
0 == '0';         // true    — the string became a number
null === undefined; // false
null == undefined;  // true  — the one useful case: "is it nullish?"

// So this checks for both, in one comparison:
if (value == null) { /* value is null or undefined */ }
`),
    ),
    p(
      'For objects, both operators compare references. Two objects with identical contents are never equal to each other.',
    ),
    code(
      js(`
{ id: 1 } === { id: 1 };  // false — two different objects

// To compare by value, compare the fields you care about,
// or for plain data:
JSON.stringify(a) === JSON.stringify(b);  // works, but key order matters
`),
    ),
    note(
      'Node has `assert.deepStrictEqual(a, b)` and `util.isDeepStrictEqual(a, b)` built in for real structural comparison. Reach for those in tests rather than stringifying.',
    ),

    h('Truthiness'),
    p(
      'Every value is either truthy or falsy in a condition. There are exactly eight falsy values, and it is worth knowing them by heart because two of them are legitimate data.',
    ),
    code(
      js(`
// The complete falsy list:
false, 0, -0, 0n, '', null, undefined, NaN
// Everything else is truthy — including [] and {} and '0' and 'false'.
`),
    ),
    warn(
      'The bug this causes: `if (!count)` is also true when `count` is `0`, and `if (!name)` is also true when `name` is an empty string. In an API, "the field is 0" and "the field was not sent" are different things.',
    ),
    p(
      'The fix is `??` and `?.`, which care about `null` and `undefined` only — not about falsiness.',
    ),
    code(
      js(`
const limit = req.query.limit ?? 20;   // 0 stays 0
const limitBad = req.query.limit || 20; // 0 becomes 20  <- the bug

const city = user?.address?.city;      // undefined instead of throwing
`),
    ),

    h('Numbers, briefly'),
    p(
      'There is one number type and it is a float, so integer arithmetic is exact only up to `Number.MAX_SAFE_INTEGER` (about 9 quadrillion) and decimal arithmetic is never exact.',
    ),
    code(
      js(`
0.1 + 0.2;                    // 0.30000000000000004
0.1 + 0.2 === 0.3;            // false

Number.MAX_SAFE_INTEGER;      // 9007199254740991
9007199254740993 === 9007199254740992; // true  <- both are the same float
`),
    ),
    tip(
      'Never store money as a float. Store it as an integer number of the smallest unit — cents, paise — or as a Postgres `numeric` that you read as a string. `12.10` becoming `12.099999` in an invoice is a real bug people ship.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Check for null or undefined', '`value == null`, or `value ?? fallback`'],
      ['Check for an array', '`Array.isArray(value)`'],
      ['Default a value that could legitimately be 0', '`??`, never `||`'],
      ['Copy an object one level deep', '`{ ...obj }`'],
      ['Copy an object all the way down', '`structuredClone(obj)`'],
      ['Compare two objects by content', '`util.isDeepStrictEqual(a, b)`'],
      ['Store money', 'Integer minor units, or a `numeric` column read as a string'],
    ]),

    h('Interview'),
    asked([
      ['Why is `typeof null` "object"?', 'A bug in the first JavaScript implementation, never fixed because it would break the web.'],
      ['What is the difference between `null` and `undefined`?', '`undefined` is "never set"; `null` is "deliberately set to nothing".'],
      ['`==` vs `===`?', '`==` coerces types first. Use `===`, except `== null` to catch both nullish values.'],
      ['Why is `0.1 + 0.2 !== 0.3`?', 'Numbers are 64-bit floats and 0.1 has no exact binary representation.'],
      ['Are objects passed by value or by reference?', 'The reference is passed by value — so the callee can mutate the object but cannot repoint your variable.'],
    ]),

    links(
      mdn('Web/JavaScript/Guide/Grammar_and_types', 'Grammar and types'),
      mdn('Web/JavaScript/Data_structures', 'JavaScript data types'),
      mdn('Web/JavaScript/Reference/Operators/Nullish_coalescing', 'Nullish coalescing'),
    ),
  ],
};
