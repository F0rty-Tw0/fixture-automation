import { connect } from 'node:net';

/**
 * Sends `GET <path>` over a bare TCP socket to `127.0.0.1:<port>`, byte for byte, so no client normalizes `..` or
 * percent escapes first; returns the whole response (status line, headers, body) once the server closes the connection.
 */
export const rawGet = async (port: number, path: string, host: string): Promise<string> => {
  const request = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`;
  const socket = connect(port, '127.0.0.1');
  let response = '';

  socket.setEncoding('utf8');
  socket.write(request);

  for await (const chunk of socket) response += String(chunk);

  return response;
};
