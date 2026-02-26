declare module 'dockerode' {
  export interface ContainerCreateOptions {
    Image: string;
    Tty?: boolean;
    Env?: string[];
    HostConfig?: {
      Binds?: string[];
      AutoRemove?: boolean;
    };
  }

  export interface ContainerWaitResult {
    StatusCode?: number;
  }

  export interface ContainerInspectResult {
    State?: {
      OOMKilled?: boolean;
    };
  }

  export interface LogOptions {
    follow?: boolean;
    stdout?: boolean;
    stderr?: boolean;
  }

  export interface Container {
    id: string;
    start(): Promise<void>;
    wait(): Promise<ContainerWaitResult>;
    logs(opts: LogOptions): Promise<NodeJS.ReadableStream>;
    kill(opts?: any): Promise<void>;
    inspect(): Promise<ContainerInspectResult>;
    modem: {
      demuxStream: (stream: NodeJS.ReadableStream, stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream) => void;
    };
  }

  export interface DockerOptions {
    socketPath?: string;
    host?: string;
    port?: number;
    protocol?: 'http' | 'https';
  }

  export default class Docker {
    constructor(options?: DockerOptions);
    createContainer(options: ContainerCreateOptions): Promise<Container>;
    getContainer(id: string): Container;
  }
}
