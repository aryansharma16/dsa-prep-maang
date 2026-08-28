import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The "name some application layer protocols" question, answered once so the
  reader is not guessing under pressure. One line each, the port, and — the part
  that makes it worth a page rather than a table — the modern replacement,
  because "we use SFTP" and "we use FTP" say very different things about a team.
*/
export const doc = {
  blocks: [
    p(
      '“Name some application layer protocols” is a question with a bad answer available to everybody — “HTTP” — and a good answer available to anyone who has read one page. This is that page: one line each, with the port and what it is actually for.',
    ),

    h('The list'),
    table(
      ['Protocol', 'Port', 'For', 'Transport'],
      [
        ['**HTTP / HTTPS**', '80 / 443', 'The web, and nearly every API', 'TCP (HTTP/3: UDP)'],
        ['**DNS**', '53', 'Names to addresses', 'UDP, TCP if large'],
        ['**SSH**', '22', 'Encrypted remote shell, tunnels, `scp`, `git`', 'TCP'],
        ['**SFTP**', '22', 'File transfer **over SSH** — same port, same session', 'TCP'],
        ['FTP / FTPS', '21 (+20)', 'Legacy file transfer; FTPS is FTP with TLS bolted on', 'TCP'],
        ['**SMTP**', '25, 587, 465', 'Sending mail (587 with STARTTLS is the modern one)', 'TCP'],
        ['**IMAP / POP3**', '143/993, 110/995', 'Reading mail — IMAP keeps it on the server, POP3 downloads it', 'TCP'],
        ['**DHCP**', '67 / 68', 'Handing out addresses', 'UDP'],
        ['**NTP**', '123', 'Clock synchronisation', 'UDP'],
        ['SNMP', '161 / 162', 'Device monitoring', 'UDP'],
        ['LDAP / LDAPS', '389 / 636', 'Directory and corporate login', 'TCP'],
        ['**WebSocket**', '80 / 443', 'Two-way messages after an HTTP upgrade', 'TCP'],
        ['**gRPC**', '443 usually', 'Binary RPC over HTTP/2', 'TCP'],
        ['MQTT', '1883 / 8883', 'Tiny pub/sub for IoT', 'TCP'],
        ['WebRTC', 'dynamic', 'Peer-to-peer audio, video and data', 'UDP'],
      ],
    ),
    tip(
      'Notice the pattern in the secure variants: 80→443, 21→990, 143→993, 110→995, 389→636. The insecure port stayed and a new one was allocated for the TLS version, because upgrading in place would have broken every client at once.',
    ),

    h('The four worth a sentence more'),

    h('SSH'),
    p(
      'An encrypted shell, and much more than a shell: it carries `scp` and `rsync`, it is what `git@github.com` speaks, and its **tunnelling** is a genuinely useful trick. `ssh -L 5432:db.internal:5432 bastion` opens a local port that forwards through a bastion host to a database in a private subnet — which is how you get a GUI client onto a database that has no public address.',
    ),
    code(
      sh(`
ssh -L 5432:db.internal:5432 ec2-user@bastion   # local port -> remote host, via bastion
psql -h localhost -p 5432                        # now works, tunnelled
`),
    ),
    note(
      'On AWS the modern replacement for that bastion is **SSM Session Manager**, which needs no open port 22 and no public IP at all. See `connecting-networks`.',
    ),

    h('SFTP vs FTPS — the question people get wrong'),
    table(
      ['', 'SFTP', 'FTPS'],
      [
        ['Is', 'A **subsystem of SSH**', 'FTP with a TLS layer added'],
        ['Ports', 'One — 22', 'Control port plus **dynamic data ports**'],
        ['Firewalls', 'Trivial', 'Painful — passive mode, port ranges'],
        ['Use', '**This one**', 'Only when a partner insists'],
      ],
    ),
    warn(
      'Plain **FTP sends credentials in cleartext** and should never be used across an untrusted network. If a system design answer needs file transfer, say SFTP or S3 with pre-signed URLs — not FTP.',
    ),

    h('Email, in three protocols'),
    ul(
      '**SMTP** *sends* — from your client to your provider, and between mail servers. Port 587 with STARTTLS for submission; 25 is server-to-server and widely blocked on consumer networks to fight spam.',
      '**IMAP** *reads*, leaving mail on the server and syncing state across devices. This is what you want.',
      '**POP3** *downloads and typically deletes*. A single-device world; effectively legacy.',
      'The anti-spoofing trio lives in DNS **TXT** records: **SPF** (which servers may send for this domain), **DKIM** (a signature proving the message was not altered) and **DMARC** (what to do when the first two fail). Every developer who has set up transactional email has met all three.',
    ),

    h('gRPC, and when to prefer it'),
    p(
      'gRPC is remote procedure calls over HTTP/2, with **Protocol Buffers** as the payload: a binary, schema-defined format instead of JSON. The schema generates client and server code in a dozen languages.',
    ),
    table(
      ['Prefer gRPC when', 'Prefer REST/JSON when'],
      [
        ['Service-to-service inside your own network', 'A public API, or a browser is the client'],
        ['You want a strict shared schema and generated clients', 'You want something curl-able and human-readable'],
        ['Payloads are large or calls are very frequent', 'Caching by URL matters'],
        ['You need streaming in either or both directions', 'Simplicity and ubiquity matter more'],
      ],
    ),
    note(
      'Browsers cannot speak gRPC directly — they lack the low-level HTTP/2 control it needs — which is why **gRPC-Web** and a proxy exist. That constraint alone decides most “should the frontend use gRPC” arguments.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Transfer files securely', 'SFTP over SSH — one port, one credential'],
      ['Reach a private database from your laptop', 'An SSH tunnel, or SSM port forwarding'],
      ['Send transactional email', 'SMTP on 587, plus SPF, DKIM and DMARC in DNS'],
      ['Read mail on many devices', 'IMAP'],
      ['Call a service from another service, fast', 'gRPC over HTTP/2'],
      ['Talk to an IoT fleet', 'MQTT'],
      ['Keep clocks in step', 'NTP — and never assume two machines agree'],
    ]),

    h('Interview'),
    asked([
      ['Name some application layer protocols.', 'HTTP, DNS, SSH, SMTP, IMAP, DHCP, NTP, FTP, LDAP, MQTT, gRPC — with 443, 53, 22, 587, 993, 67/68 and 123 as the ports worth quoting.'],
      ['SFTP vs FTPS?', 'SFTP is a subsystem of SSH on port 22; FTPS is FTP plus TLS with separate data ports and firewall pain.'],
      ['SMTP vs IMAP vs POP3?', 'SMTP sends; IMAP reads while leaving mail on the server; POP3 downloads and usually deletes.'],
      ['Why does DNS use UDP?', 'One small query and answer — a handshake would cost more than the payload; it falls back to TCP for large responses.'],
      ['When would you choose gRPC over REST?', 'Internal service-to-service calls needing a strict schema, generated clients, streaming or lower overhead.'],
      ['What is an SSH tunnel for?', 'Forwarding a local port through a reachable host to a service that has no public address.'],
    ]),

    links(
      wiki('Application_layer', 'Application layer'),
      wiki('List_of_TCP_and_UDP_port_numbers', 'List of TCP and UDP port numbers'),
      wiki('GRPC', 'gRPC'),
    ),
  ],
};
