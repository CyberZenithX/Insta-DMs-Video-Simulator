import {NextResponse} from 'next/server';
import fs from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const {searchParams} = new URL(request.url);
	const filePath = searchParams.get('file');

	if (!filePath || !fs.existsSync(filePath)) {
		return new NextResponse('File not found', {status: 404});
	}

	const stat = fs.statSync(filePath);
	const fileStream = fs.createReadStream(filePath);
	
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
