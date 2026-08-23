'use client';

import React, {useMemo, useState} from 'react';
import {Player} from '@remotion/player';
import {IgDmReel} from '../src/compositions/IgDmReel';
import {lastActiveFrame} from '../src/lib/timeline';
import {buildEventsFromScript} from '../src/lib/scriptToEvents';
import {baseIgDmReelProps, defaultClock, defaultReceiver} from '../src/data/defaultProps';
import {FPS, WIDTH, HEIGHT} from '../src/constants';
import type {ThemeName} from '../src/themes';
import type {IgDmReelProps} from '../src/types';

type ScriptMessage = {id: string; from: 'me' | 'them'; text: string};

type RenderStage = 'launching' | 'resolving' | 'rendering' | 'stitching' | 'done';

type RenderEvent =
	| {type: 'stage'; stage: RenderStage; totalFrames?: number}
	| {
			type: 'progress';
			renderedFrames: number;
			encodedFrames: number;
			totalFrames: number;
			progress: number;
			estimatedRemainingMs: number;
	  }
	| {type: 'done'; dataBase64: string}
	| {type: 'error'; error: string};

const STAGE_LABEL: Record<RenderStage, string> = {
	launching: 'Starting renderer…',
	resolving: 'Preparing composition…',
	rendering: 'Rendering frames…',
	stitching: 'Encoding video…',
	done: 'Done',
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new Blob([bytes], {type: mimeType});
};

const THEME_OPTIONS: {value: ThemeName; label: string}[] = [
	{value: 'none', label: 'None (classic black)'},
	{value: 'default', label: 'Default'},
	{value: 'berry', label: 'Berry'},
	{value: 'sweets', label: 'Sweets'},
	{value: 'unicorn', label: 'Unicorn'},
	{value: 'maple', label: 'Maple'},
	{value: 'sushi', label: 'Sushi'},
	{value: 'rocket', label: 'Rocket'},
	{value: 'lollipop', label: 'Lollipop'},
	{value: 'shadow', label: 'Shadow'},
];

let nextId = 0;
const newId = () => `msg-${nextId++}`;

const INITIAL_MESSAGES: ScriptMessage[] = [
	{id: newId(), from: 'them', text: 'yo have you seen this'},
	{id: newId(), from: 'me', text: 'seen what 👀'},
	{id: newId(), from: 'them', text: "it's actually insane"},
	{id: newId(), from: 'me', text: "no way, send it"},
];

export default function Page() {
	const [theme, setTheme] = useState<ThemeName>('none');
	const [receiverName, setReceiverName] = useState('Jordan');
	const [receiverUsername, setReceiverUsername] = useState('@jordan.codes');
	const [clock, setClock] = useState(defaultClock);
	const [messages, setMessages] = useState<ScriptMessage[]>(INITIAL_MESSAGES);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [renderStage, setRenderStage] = useState<RenderStage | null>(null);
	const [renderProgress, setRenderProgress] = useState(0);
	const [renderFrames, setRenderFrames] = useState<{done: number; total: number} | null>(null);
	const [etaMs, setEtaMs] = useState<number | null>(null);

	const events = useMemo(
		() => buildEventsFromScript(messages.map(({from, text}) => ({from, text}))),
		[messages],
	);

	const inputProps: IgDmReelProps = useMemo(
		() => ({
			...baseIgDmReelProps,
			theme,
			clock: clock || defaultClock,
			receiver: {
				...defaultReceiver,
				name: receiverName || defaultReceiver.name,
				username: receiverUsername || defaultReceiver.username,
			},
			events,
		}),
		[theme, clock, receiverName, receiverUsername, events],
	);

	const durationInFrames = Math.max(
		1,
		lastActiveFrame(events, FPS) + Math.round(baseIgDmReelProps.tailSec * FPS),
	);

	const updateMessage = (id: string, patch: Partial<ScriptMessage>) => {
		setMessages((prev) => prev.map((m) => (m.id === id ? {...m, ...patch} : m)));
	};

	const removeMessage = (id: string) => {
		setMessages((prev) => prev.filter((m) => m.id !== id));
	};

	const addMessage = () => {
		setMessages((prev) => {
			const lastFrom = prev[prev.length - 1]?.from;
			return [...prev, {id: newId(), from: lastFrom === 'me' ? 'them' : 'me', text: ''}];
		});
	};

	const generate = async () => {
		setError(null);

		if (messages.some((m) => !m.text.trim())) {
			setError('Every message needs some text before you can generate.');
			return;
		}

		setGenerating(true);
		setRenderStage('launching');
		setRenderProgress(0);
		setRenderFrames(null);
		setEtaMs(null);

		try {
			const res = await fetch('/api/render', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					theme,
					receiverName: receiverName.trim() || defaultReceiver.name,
					receiverUsername,
					clock,
					messages: messages.map(({from, text}) => ({from, text})),
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.error || `Render failed (${res.status}).`);
			}
			if (!res.body) {
				throw new Error('No response body from the server.');
			}

			// The server streams newline-delimited JSON progress events, ending
			// with either a `done` event carrying the base64 video or an `error`
			// event — a plain buffered response has nothing to show until a
			// render that can take tens of seconds has already finished.
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let finished = false;

			while (!finished) {
				const {done, value} = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, {stream: true});

				while (buffer.includes('\n')) {
					const newlineIndex = buffer.indexOf('\n');
					const line = buffer.slice(0, newlineIndex);
					buffer = buffer.slice(newlineIndex + 1);
					if (!line.trim()) continue;

					const event = JSON.parse(line) as RenderEvent;

					if (event.type === 'stage') {
						setRenderStage(event.stage);
						if (event.totalFrames) setRenderFrames({done: 0, total: event.totalFrames});
					} else if (event.type === 'progress') {
						setRenderStage('rendering');
						setRenderProgress(event.progress);
						setRenderFrames({done: event.renderedFrames, total: event.totalFrames});
						setEtaMs(event.estimatedRemainingMs);
					} else if (event.type === 'done') {
						setRenderStage('done');
						setRenderProgress(1);
						const blob = base64ToBlob(event.dataBase64, 'video/mp4');
						const url = URL.createObjectURL(blob);
						const a = document.createElement('a');
						a.href = url;
						a.download = 'ig-dm-reel.mp4';
						document.body.appendChild(a);
						a.click();
						a.remove();
						URL.revokeObjectURL(url);
						finished = true;
					} else if (event.type === 'error') {
						throw new Error(event.error);
					}
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong.');
		} finally {
			setGenerating(false);
		}
	};

	return (
		<main
			style={{
				display: 'flex',
				minHeight: '100vh',
				gap: 32,
				padding: 32,
				flexWrap: 'wrap',
			}}
		>
			<section style={{flex: '1 1 420px', maxWidth: 520}}>
				<h1 style={{fontSize: 22, fontWeight: 700, marginBottom: 4}}>Insta DM Reel Generator</h1>
				<p style={{color: '#a8a8a8', fontSize: 14, marginTop: 0, marginBottom: 24}}>
					Set the theme and conversation, preview it live, then render the MP4.
				</p>

				<label style={labelStyle}>
					Theme
					<select value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)} style={fullWidth}>
						{THEME_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</label>

				<div style={{display: 'flex', gap: 12}}>
					<label style={{...labelStyle, flex: 1}}>
						Receiver name
						<input
							value={receiverName}
							onChange={(e) => setReceiverName(e.target.value)}
							maxLength={40}
							style={fullWidth}
						/>
					</label>
					<label style={{...labelStyle, flex: 1}}>
						Username
						<input
							value={receiverUsername}
							onChange={(e) => setReceiverUsername(e.target.value)}
							maxLength={40}
							style={fullWidth}
						/>
					</label>
					<label style={{...labelStyle, width: 90}}>
						Clock
						<input value={clock} onChange={(e) => setClock(e.target.value)} maxLength={8} style={fullWidth} />
					</label>
				</div>

				<div style={{marginTop: 12}}>
					<div style={{fontSize: 13, color: '#a8a8a8', marginBottom: 8}}>Conversation</div>
					{messages.map((m) => (
						<div key={m.id} style={{display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start'}}>
							<select
								value={m.from}
								onChange={(e) => updateMessage(m.id, {from: e.target.value as 'me' | 'them'})}
								style={{width: 76, flexShrink: 0}}
							>
								<option value="them">Them</option>
								<option value="me">Me</option>
							</select>
							<textarea
								value={m.text}
								onChange={(e) => updateMessage(m.id, {text: e.target.value})}
								rows={1}
								maxLength={280}
								style={{flex: 1, resize: 'vertical'}}
							/>
							<button
								onClick={() => removeMessage(m.id)}
								disabled={messages.length <= 1}
								style={removeButtonStyle}
								aria-label="Remove message"
							>
								✕
							</button>
						</div>
					))}
					<button onClick={addMessage} style={addButtonStyle}>
						+ Add message
					</button>
				</div>

				<button onClick={generate} disabled={generating} style={generateButtonStyle}>
					{generating ? 'Rendering…' : 'Generate MP4'}
				</button>

				{generating && (
					<div style={{marginTop: 12}}>
						<div style={{display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#a8a8a8'}}>
							<span>{renderStage ? STAGE_LABEL[renderStage] : ''}</span>
							<span>
								{renderFrames ? `${renderFrames.done}/${renderFrames.total} frames · ` : ''}
								{Math.round(renderProgress * 100)}%
								{etaMs !== null && etaMs > 300 ? ` · ~${Math.ceil(etaMs / 1000)}s left` : ''}
							</span>
						</div>
						<div
							style={{
								marginTop: 6,
								height: 8,
								borderRadius: 999,
								background: '#1c1c22',
								overflow: 'hidden',
							}}
						>
							<div
								style={{
									height: '100%',
									width: `${Math.round(renderProgress * 100)}%`,
									background: 'linear-gradient(90deg, #d500c3, #7f31f6, #5a50fb)',
									transition: 'width 200ms ease-out',
								}}
							/>
						</div>
					</div>
				)}

				{error && <p style={{color: '#ff6b6b', fontSize: 13, marginTop: 8}}>{error}</p>}
			</section>

			<section style={{flex: '0 0 auto'}}>
				<div
					style={{
						width: 270,
						aspectRatio: `${WIDTH} / ${HEIGHT}`,
						borderRadius: 16,
						overflow: 'hidden',
						boxShadow: '0 0 0 1px #2e2e36',
					}}
				>
					<Player
						component={IgDmReel}
						inputProps={inputProps}
						durationInFrames={durationInFrames}
						compositionWidth={WIDTH}
						compositionHeight={HEIGHT}
						fps={FPS}
						style={{width: '100%', height: '100%'}}
						controls
						loop
					/>
				</div>
			</section>
		</main>
	);
}

const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: 13,
	color: '#a8a8a8',
	marginBottom: 12,
};

const fullWidth: React.CSSProperties = {width: '100%', marginTop: 4};

const removeButtonStyle: React.CSSProperties = {
	background: 'transparent',
	border: '1px solid #2e2e36',
	borderRadius: 8,
	color: '#a8a8a8',
	width: 34,
	height: 34,
	flexShrink: 0,
};

const addButtonStyle: React.CSSProperties = {
	background: 'transparent',
	border: '1px dashed #2e2e36',
	borderRadius: 8,
	color: '#a8a8a8',
	padding: '8px 12px',
	width: '100%',
};

const generateButtonStyle: React.CSSProperties = {
	marginTop: 20,
	width: '100%',
	padding: '12px 16px',
	borderRadius: 10,
	border: 'none',
	background: 'linear-gradient(90deg, #d500c3, #7f31f6, #5a50fb)',
	color: '#fff',
	fontWeight: 600,
	fontSize: 15,
};
