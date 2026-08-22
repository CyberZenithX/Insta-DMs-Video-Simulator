import React from 'react';
import './globals.css';

export const metadata = {
	title: 'Insta DM Reel Generator',
	description: 'Preview and render fake Instagram DM reels.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
