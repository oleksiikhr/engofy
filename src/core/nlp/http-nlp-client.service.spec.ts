import { HttpNlpClientService } from './http-nlp-client.service.js';
import type { NlpParseResult } from './nlp-client.port.js';

const STATUS_AND_BODY = /500.*boom/s;
const TRANSPORT_FAILURE = /nlp-service request failed/;

const SAMPLE: NlpParseResult = {
  sentences: [
    {
      text: 'Hi there.',
      start: 0,
      end: 9,
      tokens: [
        {
          index: 0,
          text: 'Hi',
          lemma: 'hi',
          pos: 'INTJ',
          tag: 'UH',
          dep: 'ROOT',
          morph: {},
          head: 0,
          start: 0,
          end: 2,
        },
      ],
    },
  ],
};

describe('HttpNlpClientService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the text to <baseUrl>/parse and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(SAMPLE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new HttpNlpClientService('http://nlp.test:8000/', 5000);
    const result = await client.parse('Hi there.');

    expect(result).toEqual(SAMPLE);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://nlp.test:8000/parse');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Hi there.' });
  });

  it('throws with the status and body when the service responds non-2xx', async () => {
    fetchMock.mockResolvedValue(
      new Response('boom', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const client = new HttpNlpClientService('http://nlp.test:8000', 5000);

    await expect(client.parse('x')).rejects.toThrow(STATUS_AND_BODY);
  });

  it('wraps a transport failure', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const client = new HttpNlpClientService('http://nlp.test:8000', 5000);

    await expect(client.parse('x')).rejects.toThrow(TRANSPORT_FAILURE);
  });
});
