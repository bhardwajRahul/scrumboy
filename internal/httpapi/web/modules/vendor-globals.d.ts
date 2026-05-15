declare global {
  type MarkdownItRendererRule = (
    tokens: any[],
    idx: number,
    options: any,
    env: any,
    self: {
      renderToken(tokens: any[], idx: number, options: any): string;
    },
  ) => string;

  type MarkdownItInstance = {
    render(markdown: string): string;
    renderer: {
      rules: Record<string, MarkdownItRendererRule | undefined>;
    };
  };

  type MarkdownItFactory = (
    presetName?: string,
    options?: {
      html?: boolean;
      breaks?: boolean;
      linkify?: boolean;
    },
  ) => MarkdownItInstance;

  type DOMPurifyLike = {
    sanitize(dirty: string, config?: Record<string, unknown>): string;
  };

  interface Window {
    markdownit?: MarkdownItFactory;
    DOMPurify?: DOMPurifyLike;
  }
}

export {};
