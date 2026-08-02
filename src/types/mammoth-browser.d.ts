declare module "mammoth/mammoth.browser" {
  export interface MammothMessage {
    message: string;
  }

  export function extractRawText(options: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: MammothMessage[] }>;
}
