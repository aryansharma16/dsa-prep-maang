import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`package.json` is the manifest for a Node project: what it is called, how to start it, what it depends on and which module system it uses. npm is the tool that reads it. Between them they decide what code actually ends up running, which makes the lockfile the most important file in the repository after your own source.',
    ),

    h('A real one'),
    code(
      js(`
{
  "name": "tasks-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch --env-file=.env src/index.js",
    "test": "node --test",
    "migrate": "node scripts/migrate.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "pg": "^8.13.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
`),
    ),
    table(
      ['Field', 'Why it matters'],
      [
        ['`"type"`', '`"module"` makes every `.js` file an ES module. Absent means CommonJS. This changes how the whole project is parsed.'],
        ['`"private": true`', 'Stops `npm publish` ever succeeding by accident. Set it on every application.'],
        ['`"engines"`', 'Declares the Node version. npm warns; `--engine-strict` and most CI images enforce.'],
        ['`"scripts"`', 'Named commands, run with `npm run <name>`.'],
        ['`"dependencies"`', 'Needed at runtime. Installed in production.'],
        ['`"devDependencies"`', 'Needed only to build or test. Skipped by `npm ci --omit=dev`.'],
      ],
    ),

    h('Installing'),
    code(
      sh(`
npm install express            # add to dependencies
npm install -D supertest       # add to devDependencies
npm install                    # install everything in package.json
npm ci                         # install exactly what the lockfile says
npm uninstall express
npm update                     # move within the allowed ranges
npm outdated                   # what is behind, and by how much
`),
    ),
    table(
      ['', '`npm install`', '`npm ci`'],
      [
        ['Reads', '`package.json`, then the lockfile', 'The lockfile only'],
        ['Can change the lockfile', 'Yes', 'No — it errors if they disagree'],
        ['Existing `node_modules`', 'Updated in place', 'Deleted and rebuilt'],
        ['Use it', 'While developing', '**In CI and in Docker builds**'],
      ],
    ),
    tip(
      'Use `npm ci` in every automated build. It is faster, and it guarantees the bytes you tested are the bytes you deployed. `npm install` in a Dockerfile can silently pick up a new patch release between your test run and your deploy.',
    ),

    h('Semver'),
    p(
      'Versions are `MAJOR.MINOR.PATCH`. The prefix in front of the version in `package.json` says what npm is allowed to upgrade to without being asked.',
    ),
    table(
      ['Range', 'Allows', 'For `4.21.2`'],
      [
        ['`^4.21.2`', 'Minor and patch — no major', '`4.21.2` up to but not `5.0.0`'],
        ['`~4.21.2`', 'Patch only', '`4.21.2` up to but not `4.22.0`'],
        ['`4.21.2`', 'Exactly that', 'Only `4.21.2`'],
        ['`*` or `latest`', 'Anything', 'Never do this'],
      ],
    ),
    warn(
      'Below `1.0.0` the rules shift: `^0.3.1` allows only `0.3.x`, because pre-1.0 packages treat the minor as a breaking change. This catches people out with young libraries.',
    ),

    h('The lockfile'),
    p(
      '`package.json` records ranges; `package-lock.json` records the exact version and integrity hash of every package **and every transitive dependency**. Without it, two installs a week apart give you different code from the same manifest.',
    ),
    code(
      sh(`
git add package-lock.json      # always commit it for an application
`),
    ),
    note(
      'A library — something other people install — has a different calculus: the lockfile is still committed, but it does not constrain consumers, because their own tree is resolved from your declared ranges.',
    ),

    h('Scripts'),
    code(
      sh(`
npm run dev                 # any script by name
npm start                   # 'start' and 'test' need no 'run'
npm test
npm run                     # list every script

npm run migrate -- --dry-run   # everything after -- goes to the script
`),
    ),
    p(
      'Inside a script, `node_modules/.bin` is on the PATH — so `"test": "vitest"` works without a path, even though `vitest` is not installed globally.',
    ),
    code(
      js(`
{
  "scripts": {
    "prestart": "npm run build",     // runs automatically before 'start'
    "start": "node dist/index.js",
    "poststart": "echo up"           // and after
  }
}
`),
    ),

    h('npx'),
    code(
      sh(`
npx prisma migrate dev        # run a local dependency's binary
npx create-vite@latest app    # download, run once, do not install
`),
    ),
    warn(
      '`npx <name>` will download and execute a package from the registry if it is not installed locally. Check the name — typosquatting on popular package names is a real supply-chain attack, and you are handing it a shell.',
    ),

    h('Auditing'),
    code(
      sh(`
npm audit                    # known vulnerabilities in your tree
npm audit fix                # upgrade within existing ranges
npm audit --omit=dev         # only what actually ships

npm ls express               # why is this here, and which version
npm ls --depth=0             # your direct dependencies only
`),
    ),
    tip(
      'Read `npm audit` output before acting on it. A high-severity advisory in a build-only tool that never sees user input is not the same as one in your HTTP parser, and `npm audit fix --force` will happily install a major version that breaks you.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Start a project', '`npm init -y`'],
      ['Add a runtime dependency', '`npm install <pkg>`'],
      ['Add a build/test-only one', '`npm install -D <pkg>`'],
      ['Install in CI or Docker', '`npm ci`'],
      ['Run a project command', '`npm run <script>`'],
      ['Pass args to a script', '`npm run x -- --flag`'],
      ['Use ESM', '`"type": "module"`'],
      ['Find why a package is installed', '`npm ls <pkg>`'],
      ['Check for vulnerabilities', '`npm audit --omit=dev`'],
    ]),

    h('Interview'),
    asked([
      ['`npm install` vs `npm ci`?', '`install` may update the lockfile; `ci` installs exactly the lockfile and fails if it disagrees with the manifest.'],
      ['What do `^` and `~` allow?', '`^` minor and patch, `~` patch only — with pre-1.0 versions treating minor as breaking.'],
      ['Why commit the lockfile?', 'It pins every transitive dependency, so builds are reproducible and what you tested is what you deploy.'],
      ['dependencies vs devDependencies?', 'Runtime versus build/test only; production installs skip the second.'],
      ['What does `"type": "module"` do?', 'Makes every `.js` file in the package an ES module rather than CommonJS.'],
      ['How do you reduce supply-chain risk?', 'Lockfile plus `npm ci`, audit in CI, few dependencies, and check names before `npx`.'],
    ]),

    links(
      link('package.json reference', 'https://docs.npmjs.com/cli/v10/configuring-npm/package-json'),
      link('npm ci', 'https://docs.npmjs.com/cli/v10/commands/npm-ci'),
      nodeDoc('packages.html', 'Node.js packages'),
    ),
  ],
};
