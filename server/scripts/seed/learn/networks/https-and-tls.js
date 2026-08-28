import { asked, awsDoc, cheat, code, h, links, mdn, note, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'HTTPS is HTTP inside a **TLS** tunnel. TLS gives three things, and naming all three is what separates a good answer from “it encrypts stuff”: **confidentiality** (nobody on the path can read it), **integrity** (nobody can change it undetected) and **authentication** (you are talking to who you think you are).',
    ),
    p(
      'The third is the one people forget and the one that actually matters most. Encryption to an attacker is worthless — without authentication, anyone in the middle can encrypt happily with you while reading everything.',
    ),

    h('Two kinds of encryption, and why both'),
    table(
      ['', 'Asymmetric (public key)', 'Symmetric'],
      [
        ['Keys', 'A public/private pair', 'One shared secret'],
        ['Speed', 'Slow — hundreds of times slower', '**Fast**, hardware accelerated'],
        ['Solves', 'Agreeing a secret with a stranger; proving identity', 'Bulk data'],
        ['In TLS', 'The **handshake** only', 'Everything after it'],
      ],
    ),
    p(
      'That is the whole architectural idea: **use the slow one briefly to agree on a key for the fast one.** Asymmetric maths lets two parties who have never met derive the same secret over a public channel; symmetric encryption then carries the gigabytes.',
    ),

    h('The handshake — TLS 1.3, one round trip'),
    code(
      sh(`
client                                                     server
  |--- ClientHello ----------------------------------------->|
  |    TLS version, cipher suites, key share, SNI: api.example.com
  |
  |<-- ServerHello + certificate + key share + Finished -----|
  |    picks a cipher, sends its chain, proves it holds the private key
  |
  |    [client validates the chain, derives the shared secret]
  |
  |--- Finished ---------------------------------------------->|
  |=== encrypted application data ============================|
`),
    ),
    ul(
      '**ClientHello** — what I support, plus my half of the key exchange, plus **SNI**, the hostname *in the clear*, so a server hosting many sites knows which certificate to send.',
      '**Certificate** — the server’s public key and identity, signed by a certificate authority, with the intermediate chain.',
      '**Validation** — the client checks the signature chain up to a root it trusts, that the name matches, that the dates are valid, and that it has not been revoked.',
      '**Key derivation** — both sides compute the same session key. With ephemeral Diffie-Hellman the private key never encrypts it, which gives **forward secrecy**: stealing the server’s private key tomorrow does not decrypt traffic captured today.',
      '**Finished** — both prove they derived the same key; everything after is symmetric.',
    ),
    note(
      'TLS 1.2 needed **two** round trips. TLS 1.3 cut it to one by having the client guess the key-exchange parameters up front, and dropped every legacy cipher along the way. On a 100 ms path that is 100 ms saved on every new connection — and a resumed session can be **0-RTT**.',
    ),

    h('What a certificate actually proves'),
    p(
      'A certificate says: *this public key belongs to this hostname*, and a **certificate authority** vouched for it. Your browser and OS ship with a list of ~150 trusted roots; a certificate is trusted if a chain of signatures leads to one of them.',
    ),
    table(
      ['Type', 'The CA checked', 'Cost'],
      [
        ['**DV** — domain validated', 'You control the domain (a DNS record or a file on the server)', 'Free — Let’s Encrypt, ACM'],
        ['OV — organisation validated', 'The company exists', 'Paid'],
        ['EV — extended validation', 'Deeper legal checks', 'Expensive; browsers no longer show it specially'],
      ],
    ),
    warn(
      'A certificate proves **identity, not virtue**. A phishing site at `paypa1.com` can hold a perfectly valid free certificate and show a padlock. The padlock means "the connection is private and this really is `paypa1.com`" — it never meant "this site is honest", and teaching users otherwise was a mistake the industry has spent a decade walking back.',
    ),

    h('The errors, and what each one means'),
    table(
      ['Error', 'Cause'],
      [
        ['`CERT_HAS_EXPIRED`', 'Nobody renewed it. The single most common outage in this list'],
        ['`ERR_CERT_COMMON_NAME_INVALID`', 'The certificate is for a different hostname — often `example.com` used on `www.example.com`'],
        ['`UNABLE_TO_VERIFY_LEAF_SIGNATURE`', 'The server did not send the **intermediate** certificate; browsers often paper over it, other clients do not'],
        ['`SELF_SIGNED_CERT_IN_CHAIN`', 'Self-signed, or a corporate proxy intercepting TLS'],
        ['Handshake failure', 'No cipher or protocol version in common — usually an ancient client'],
      ],
    ),
    tip(
      '“It works in the browser but fails in `curl`/Node” is almost always the missing intermediate. Browsers fetch it themselves; most other clients will not. Check with `openssl s_client -connect host:443 -showcerts` and look at how many certificates come back.',
    ),

    h('Where TLS is terminated'),
    p('“Termination” is where the encryption stops and plaintext continues. There are three arrangements and each is a legitimate answer to a design question:'),
    table(
      ['Pattern', 'Encrypted up to', 'Use when'],
      [
        ['**Termination at the edge**', 'The CDN or load balancer', 'The default: the LB can then route on path, add headers, cache'],
        ['**Re-encryption**', 'Edge, then a second TLS hop to the app', 'The internal network is not trusted — regulated environments'],
        ['**Passthrough**', 'All the way to the application', 'End-to-end requirements, or mutual TLS; the L4 balancer cannot read anything'],
      ],
    ),
    p(
      'Terminating at the load balancer is why your Node app happily serves plain HTTP in production: the ALB or CloudFront holds the certificate, and the hop behind it is inside your VPC. It is also why your app must trust `X-Forwarded-Proto` to know the user was on HTTPS — see `proxies`.',
    ),
    note(
      'On AWS: **ACM** issues and auto-renews certificates for free, and attaches them to CloudFront, an ALB or API Gateway. Certificates for CloudFront must be issued in `us-east-1` regardless of where everything else lives — a rule that has cost everyone an afternoon at least once.',
    ),

    h('HSTS, and getting the first request right'),
    p(
      'A user typing `example.com` speaks plain HTTP first, and that first request is interceptable however good your TLS is. **HSTS** — `Strict-Transport-Security` — tells the browser "never use HTTP for this host again, for the next N seconds", so only the very first visit is exposed. Submitting the domain to the **preload list** shipped with browsers closes even that.',
    ),
    code(
      sh(`
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
`),
    ),
    warn(
      '`includeSubDomains` with a long `max-age` is hard to undo — every subdomain must have a valid certificate for as long as the header’s lifetime, in every browser that saw it. Start with a short `max-age` and raise it once you are sure.',
    ),

    h('Inspecting it'),
    code(
      sh(`
openssl s_client -connect example.com:443 -servername example.com
echo | openssl s_client -connect example.com:443 2>/dev/null \\
  | openssl x509 -noout -dates -subject -issuer
curl -vI https://example.com          # the TLS lines in the verbose output
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Name what TLS provides', 'Confidentiality, integrity, authentication'],
      ['Explain the two encryptions', 'Asymmetric to agree a key, symmetric for the data'],
      ['Serve many certificates on one IP', 'SNI in the ClientHello'],
      ['Get free, auto-renewing certificates', 'Let’s Encrypt, or ACM on AWS'],
      ['Fix “works in browser, fails in curl”', 'Send the intermediate certificate'],
      ['Force HTTPS for returning users', 'HSTS, and preload'],
      ['Let the load balancer route on path', 'Terminate TLS at the edge'],
      ['Check expiry from the terminal', '`openssl s_client` piped to `openssl x509 -dates`'],
    ]),

    h('Interview'),
    asked([
      ['Walk me through the TLS handshake.', 'ClientHello with ciphers and a key share, ServerHello with the certificate and its key share, the client validates the chain, both derive a session key, then symmetric encryption.'],
      ['Why both asymmetric and symmetric?', 'Asymmetric agrees a secret with a stranger and proves identity but is slow; symmetric is fast and carries the data.'],
      ['What does a CA vouch for?', 'That this public key belongs to this hostname — identity, not trustworthiness.'],
      ['What is forward secrecy?', 'Ephemeral key exchange means a stolen private key cannot decrypt previously captured sessions.'],
      ['What is SNI?', 'The hostname sent in the clear in the ClientHello so a server with many certificates knows which to present.'],
      ['What changed in TLS 1.3?', 'One round trip instead of two, 0-RTT resumption, and all legacy ciphers removed.'],
      ['What is TLS termination?', 'Where decryption happens — usually the load balancer or CDN, which is why the app behind it can speak plain HTTP.'],
      ['What is HSTS for?', 'To stop the browser ever trying plain HTTP for this host, closing the first-request gap.'],
    ]),

    links(
      mdn('Web/Security/Transport_Layer_Security', 'Transport Layer Security'),
      rfc(8446, 'RFC 8446 — TLS 1.3'),
      wiki('Public_key_infrastructure', 'Public key infrastructure'),
      awsDoc('acm/latest/userguide/acm-overview.html', 'AWS Certificate Manager'),
    ),
  ],
};
