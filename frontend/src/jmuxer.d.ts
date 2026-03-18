declare module 'jmuxer' {
  interface JMuxerOptions {
    node: HTMLVideoElement;
    mode: 'video' | 'audio' | 'both';
    flushingTime?: number;
    fps?: number;
    debug?: boolean;
  }
  interface FeedData {
    video?: Uint8Array;
    audio?: Uint8Array;
  }
  class JMuxer {
    constructor(options: JMuxerOptions);
    feed(data: FeedData): void;
    destroy(): void;
  }
  export default JMuxer;
}
