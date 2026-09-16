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

	const fileBuffer = fs.readFileSync(filePath);

	return new NextResponse(fileBuffer, {
		headers: {
			'Content-Type': 'video/mp4',
			'Content-Disposition': 'attachment; filename="ig-dm-reel.mp4"',
		},
	});
}
