const MAX_MESSAGE_SIZE = 20 * 1024 * 1024;
export const IMAGE_MESSAGE_CHUNK_SIZE = 48 * 1024;

/** One bounded, ordered transfer per explicit save request. */
export class NetworkImageTransport {
  private parts: string[] = [];
  private requestId = '';
  private transferId = '';
  private total = 0;
  private size = 0;

  clear() {
    this.parts = [];
    this.requestId = this.transferId = '';
    this.size = this.total = 0;
  }

  receive(raw: string, expectedRequestId?: string): string | null {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return raw;
    }
    if (message?.type !== 'NETWORK_IMAGES_CHUNK') return raw;
    if (!expectedRequestId || message.requestId !== expectedRequestId) return null;
    const { index, total, data, transferId } = message;
    if (
      !Number.isInteger(index) ||
      !Number.isInteger(total) ||
      total < 1 ||
      total > Math.ceil(MAX_MESSAGE_SIZE / IMAGE_MESSAGE_CHUNK_SIZE) ||
      index < 0 ||
      index >= total ||
      typeof transferId !== 'string' ||
      transferId.length > 150 ||
      typeof data !== 'string' ||
      data.length > IMAGE_MESSAGE_CHUNK_SIZE
    ) {
      this.clear();
      throw new Error('INVALID_TRANSFER');
    }
    if (index === 0) {
      this.clear();
      this.requestId = expectedRequestId;
      this.transferId = transferId;
      this.total = total;
    }
    if (
      this.requestId !== expectedRequestId ||
      this.transferId !== transferId ||
      this.total !== total ||
      this.parts.length !== index
    ) {
      this.clear();
      throw new Error('INCOMPLETE_TRANSFER');
    }
    this.size += data.length;
    if (this.size > MAX_MESSAGE_SIZE) {
      this.clear();
      throw new Error('TRANSFER_TOO_LARGE');
    }
    this.parts.push(data);
    if (this.parts.length !== total) return null;
    const joined = this.parts.join('');
    this.clear();
    return joined;
  }
}

export const IMAGE_MESSAGE_TRANSPORT_FUNCTION = String.raw`function (message) {
  var text = JSON.stringify(message);
  if (!message.requestId || text.length <= 49152) {
    window.ReactNativeWebView.postMessage(text); return;
  }
  if (text.length > 20971520) throw new Error('TRANSFER_TOO_LARGE');
  var total = Math.ceil(text.length / 49152);
  var transferId = message.requestId + '-' + Date.now();
  for (var index = 0; index < total; index++) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'NETWORK_IMAGES_CHUNK', requestId: message.requestId,
      transferId: transferId, index: index, total: total,
      data: text.slice(index * 49152, (index + 1) * 49152)
    }));
  }
}`;
