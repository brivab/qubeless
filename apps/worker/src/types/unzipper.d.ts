declare module 'unzipper' {
  import { Writable } from 'stream';
  interface ExtractOptions {
    path: string;
  }
  export function Extract(options: ExtractOptions): Writable;
  const unzipper: { Extract: typeof Extract };
  export default unzipper;
}
