import { asked, cheat, code, h, js, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'An IP address identifies a **machine**. A **port** identifies a *process* on it. A 16-bit number, so 0–65535, and it is the only reason one server can run a website, a database and SSH at once without the packets getting confused.',
    ),

    h('The five-tuple'),
    p(
      'A **socket** is not a port. A socket is one endpoint of one connection, and a TCP connection is identified by **five** values together:',
    ),
    code(
      sh(`
(protocol, source IP, source port, destination IP, destination port)

 TCP  203.0.113.9 : 51000  ->  10.0.1.7 : 443     client A
 TCP  203.0.113.9 : 51001  ->  10.0.1.7 : 443     client A, second tab
 TCP  198.51.100.4: 51000  ->  10.0.1.7 : 443     client B, same source port — fine
`),
    ),
    p(
      'That is the answer to the question people find surprising: **how can ten thousand clients all connect to port 443?** Because the port is only one fifth of the identity. The server has one *listening* socket on 443 and one *connected* socket per client, each distinguished by the client’s address and port.',
    ),
    note(
      'The real limit on concurrent connections is memory and file descriptors, not ports — on the server side. On the **client** side the limit is real: about 28,000 ephemeral ports to any one destination, which is exactly the `TIME_WAIT` exhaustion story from the previous topic.',
    ),

    h('The three ranges'),
    table(
      ['Range', 'Name', 'Notes'],
      [
        ['0–1023', '**Well-known**', 'Assigned by IANA; binding one needs root on Unix'],
        ['1024–49151', 'Registered', 'Databases, app servers — 3000, 5432, 8080 live here'],
        ['49152–65535', '**Ephemeral**', 'Picked at random by the OS for outbound connections'],
      ],
    ),
    p(
      'That root requirement is why a container runs your app on 3000 or 8080 and something in front maps 80 and 443 onto it — and why `sudo` is what people reach for when `EACCES` appears on port 80.',
    ),

    h('The ports worth knowing by heart'),
    table(
      ['Port', 'Service', 'Port', 'Service'],
      [
        ['**20 / 21**', 'FTP data / control', '**443**', '**HTTPS**'],
        ['**22**', '**SSH**, SFTP', '445', 'SMB'],
        ['**25**', 'SMTP (mail sending)', '**3306**', '**MySQL**'],
        ['**53**', '**DNS**', '3389', 'RDP'],
        ['67 / 68', 'DHCP server / client', '**5432**', '**PostgreSQL**'],
        ['**80**', '**HTTP**', '**6379**', '**Redis**'],
        ['110 / 143', 'POP3 / IMAP', '8080', 'HTTP alternate, proxies'],
        ['123', 'NTP', '9200', 'Elasticsearch'],
        ['161', 'SNMP', '27017', 'MongoDB'],
        ['389 / 636', 'LDAP / LDAPS', '5672', 'RabbitMQ / AMQP'],
      ],
    ),
    tip(
      'Interviewers reliably ask for 22, 53, 80, 443, 3306, 5432 and 6379. The rest are recognition, not recall. Notice the secure-variant pattern too: 80→443, 21→990, 143→993, 389→636.',
    ),

    h('What binding actually does'),
    code(
      js(`
const server = net.createServer(onConnection);

server.listen(3000, '127.0.0.1');   // reachable ONLY from this machine
server.listen(3000, '0.0.0.0');     // reachable on EVERY interface
server.listen(3000);                // Node's default: all interfaces
`),
    ),
    p(
      'You bind an address **and** a port. Binding to `127.0.0.1` is what makes a dev server invisible from a container, a phone on the same WiFi or a colleague’s laptop — and binding to `0.0.0.0` is what makes it visible to all of them, including a café network.',
    ),
    warn(
      '`EADDRINUSE` — "address already in use" — means something else holds that address/port pair. Usually a previous run of your own app that did not exit. `lsof -i :3000` or `ss -lptn "sport = :3000"` names the process. It can also mean the socket is still in `TIME_WAIT`, which is what `SO_REUSEADDR` exists to allow past.',
    ),

    h('Checking a port from the outside'),
    code(
      sh(`
ss -lntp                       # what is LISTENING here, and which process
nc -zv api.example.com 443     # can I open a TCP connection to that port?
curl -v telnet://host:5432     # same idea, curl-flavoured
nmap -p 22,80,443 host         # several at once (only on hosts you own)
`),
    ),
    p('Three outcomes, and each rules something different out:'),
    table(
      ['Result', 'Means'],
      [
        ['Connected', 'Something is listening and the path is open'],
        ['**Refused** (immediately)', 'You reached the host; nothing is on that port — it sent RST'],
        ['**Timed out** (hangs)', 'Packets are being dropped — a firewall, a security group, wrong subnet'],
      ],
    ),
    note(
      'That distinction is the most useful debugging fact in this whole track. *Refused means you got there.* Timed out means you did not, and the thing to inspect is a firewall rule, not the application.',
    ),

    h('Ports in the cloud'),
    ul(
      'A **security group** rule is a port range plus a source — “allow 443 from `0.0.0.0/0`”, “allow 5432 from the app security group”.',
      'A **target group** maps the load balancer’s public port (443) to the container’s port (3000).',
      'A container publishes `-p 8080:3000`: host port 8080 to container port 3000. Getting these backwards is a rite of passage.',
      'Databases should never have a port open to `0.0.0.0/0`. Allow 5432 **from the app’s security group** and nothing else.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Identify a connection', 'The five-tuple: protocol, both IPs, both ports'],
      ['Serve many clients on one port', 'One listening socket, one connected socket each — the tuple differs'],
      ['Expose a dev server to a container', 'Bind `0.0.0.0`, not `127.0.0.1`'],
      ['Find who holds port 3000', '`lsof -i :3000` or `ss -lptn`'],
      ['Test a remote port', '`nc -zv host port`'],
      ['Read the result', 'Refused = reached it; timeout = firewall'],
      ['Lock down a database', 'Allow its port only from the app’s security group'],
    ]),

    h('Interview'),
    asked([
      ['What is a port?', 'A 16-bit number identifying which process on a host a segment belongs to.'],
      ['What is a socket?', 'One endpoint of a connection, identified with its peer by the five-tuple of protocol and both address/port pairs.'],
      ['How do thousands of clients share port 443?', 'Each connection has a distinct five-tuple; the server keeps one connected socket per client.'],
      ['What limits concurrent connections?', 'File descriptors and memory on the server; ephemeral ports per destination on the client.'],
      ['Why do apps run on 3000 or 8080?', 'Ports below 1024 need root, so a proxy or load balancer maps 80 and 443 onto the high port.'],
      ['Connection refused vs timeout?', 'Refused is an RST from a reachable host with nothing listening; a timeout is packets dropped, usually by a firewall.'],
      ['Name the ports for SSH, DNS, HTTPS, Postgres, Redis.', '22, 53, 443, 5432, 6379.'],
    ]),

    links(
      wiki('Port_(computer_networking)', 'Port'),
      wiki('List_of_TCP_and_UDP_port_numbers', 'List of TCP and UDP port numbers'),
      wiki('Network_socket', 'Network socket'),
    ),
  ],
};
