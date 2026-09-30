// Test-only: a tiny SMTP server that accepts every e-mail and keeps it in
// memory, so the sign-in link can be read without sending real e-mail.
// Messages are available as JSON at GET /messages on the HTTP port.
import net from "node:net";
import http from "node:http";

const messages = [];

function decodeQuotedPrintable(text) {
  const bytes = [];
  const src = text.replace(/=\r?\n/g, "");
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "=" && /^[0-9A-F]{2}$/i.test(src.slice(i + 1, i + 3))) {
      bytes.push(parseInt(src.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...Buffer.from(src[i], "utf8"));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

export function startMailCatcher({ smtpPort = 2500, httpPort = 2501 } = {}) {
  net
    .createServer((socket) => {
      let buffer = "";
      let inData = false;
      let envelope = { from: "", to: [] };
      const reply = (line) => socket.write(line + "\r\n");
      reply("220 localhost mail-catcher");
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        while (true) {
          if (inData) {
            const end = buffer.indexOf("\r\n.\r\n");
            if (end < 0) return;
            const raw = buffer.slice(0, end);
            buffer = buffer.slice(end + 5);
            inData = false;
            const [headers, ...bodyParts] = raw.split(/\r?\n\r?\n/);
            const body = bodyParts.join("\n\n");
            messages.push({
              ...envelope,
              subject: (headers.match(/^Subject: (.*)$/im) ?? [])[1] ?? "",
              body: /quoted-printable/i.test(raw) ? decodeQuotedPrintable(body) : body,
              receivedAt: new Date().toISOString(),
            });
            envelope = { from: "", to: [] };
            reply("250 OK");
            continue;
          }
          const idx = buffer.indexOf("\r\n");
          if (idx < 0) return;
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const cmd = line.slice(0, 4).toUpperCase();
          if (cmd === "EHLO" || cmd === "HELO") reply("250 localhost");
          else if (cmd === "MAIL") { envelope.from = line.slice(10).trim(); reply("250 OK"); }
          else if (cmd === "RCPT") { envelope.to.push(line.slice(8).trim().replace(/[<>]/g, "")); reply("250 OK"); }
          else if (cmd === "DATA") { inData = true; reply("354 End data with <CR><LF>.<CR><LF>"); }
          else if (cmd === "QUIT") { reply("221 Bye"); socket.end(); return; }
          else reply("250 OK");
        }
      });
      socket.on("error", () => {});
    })
    .listen(smtpPort, "127.0.0.1");

  http
    .createServer((req, res) => {
      res.setHeader("content-type", "application/json; charset=utf-8");
      if (req.method === "DELETE") messages.length = 0;
      res.end(JSON.stringify(messages));
    })
    .listen(httpPort, "127.0.0.1");
}
