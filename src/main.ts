import { Socket } from "node:net";

export interface TCPConnection {
  sendCommand: (command: string, immediate?: boolean) => Promise<string>;
  sendBinaryCommand: (
    command: string,
    immediate?: boolean,
  ) => Promise<Uint8Array>;
  close: () => void;
}

const concat = (
  a: Uint8Array<ArrayBuffer>,
  b: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> => {
  const totalSize = a.byteLength + b.byteLength;
  const combined = new Uint8Array(totalSize);
  combined.set(a, 0);
  combined.set(b, a.byteLength);
  return combined;
};

export class TCPClient implements TCPConnection {
  #connection: Socket;
  constructor(connection: Socket) {
    this.#connection = connection;
  }
  /**
   * Create a new TCPClient instance with host and port
   * @param host MPD server host address
   * @param port MPD server port number
   * @returns
   */
  static async connect(host: string, port: number): Promise<TCPClient> {
    const socket = new Socket();
    socket.connect(port, host);

    return new TCPClient(socket);
  }

  close(): void {
    this.#connection.destroy();
  }

  async sendBinaryCommand(
    command: string,
    immediate?: boolean,
  ): Promise<Uint8Array> {
    return new Promise((res, rej) => {
      let result = new Uint8Array();
      this.#connection.write(command);
      this.#connection.on("data", (data: any) => {
        const binary = new Uint8Array(data);
        const response = data.toString("utf-8");
        result = concat(result, binary);
        if (immediate) {
          this.#connection.end();
        } else {
          if (response.startsWith("ACK ")) {
            this.#connection.end();
          }
          if (response.endsWith("OK\n")) {
            this.#connection.end();
          }
        }
      });
      this.#connection.once("end", () => {
        res(result);
      });
      this.#connection.once("error", (err) => {
        rej(err);
      });
    });
  }

  async sendCommand(command: string, immediate?: boolean): Promise<string> {
    const responseBinary = await this.sendBinaryCommand(command, immediate);
    return new TextDecoder().decode(responseBinary);
  }
}
