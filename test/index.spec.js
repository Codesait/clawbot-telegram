
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('ClawBot worker', () => {
	it('responds with OK to valid Telegram POST', async () => {
		const request = new Request('http://example.com', {
			method: 'POST',
			body: JSON.stringify({
				message: {
					chat: { id: 123 },
					text: '/start'
				}
			})
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"OK"`);
	});


	it('ignores non-POST requests', async () => {
		const request = new Request('http://example.com', { method: 'GET' });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"OK"`);
	});

	it('responds to /myrepos', async () => {
		const request = new Request('http://example.com', {
			method: 'POST',
			body: JSON.stringify({
				message: {
					chat: { id: 123 },
					text: '/myrepos'
				}
			})
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"OK"`);
	});
});
