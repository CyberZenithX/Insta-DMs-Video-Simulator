import {NextResponse} from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const {searchParams} = new URL(request.url);
	const filePath = searchParams.get('file');

	if (!filePath) {
		return new NextResponse('Missing file parameter', {status: 400});
	}

	// Security: only allow serving files from tmpdir that match our render naming convention
	const resolved = path.resolve(filePath);
	const tmpDir = os.tmpdir();
	if (!resolved.startsWith(tmpDir) || !path.basename(resolved).startsWith('local-')) {
		return new NextResponse('Forbidden', {status: 403});
	}

	if (!fs.existsSync(resolved)) {
		return new NextResponse('File not found', {status: 404});
	}

	const stat = fs.statSync(resolved);
	const fileStream = fs.createReadStream(resolved);
	
	// Convert Node.js Readable stream to Web ReadableStream
	const stream = new ReadableStream({
		start(controller) {
			fileStream.on('data', (chunk) => controller.enqueue(chunk));
			fileStream.on('end', () => controller.close());
			fileStream.on('error', (err) => controller.error(err));
		},
		cancel() {
			fileStream.destroy();
		},
	});

	return new NextResponse(stream, {
		headers: {
			'Content-Type': 'video/mp4',
			'Content-Length': stat.size.toString(),
			'Content-Disposition': 'attachment; filename="ig-dm-reel.mp4"',
		},
	});
}
