// ── Timeline component (Solid.js) ────────────────────────────────────
// Time-travel slider for stepping through membrane events.
// Ported from model-webapp/app/components/Timeline.tsx (React).

import { For, createSignal } from "solid-js";
import type { JSX, Accessor } from "solid-js";

export type TimelineProps = {
    currentEventIndex: Accessor<number>;
    totalEvents: Accessor<number>;
    isPlaying: Accessor<boolean>;
    onEventChange: (index: number) => void;
    onPlayPause: () => void;
    speedIndex: Accessor<number>;
    speedLabels: readonly string[];
    onSpeedChange: (index: number) => void;
};

export function Timeline(props: TimelineProps): JSX.Element {
    const [speedOpen, setSpeedOpen] = createSignal(false);

    const handleSliderInput = (e: InputEvent) => {
        const newIdx = parseInt((e.currentTarget as HTMLInputElement).value, 10);
        props.onEventChange(newIdx);
    };

    // Total positions includes blank (-1) + all events (0 to totalEvents-1)
    const totalPositions = () => props.totalEvents() + 1;

    return (
        <div class="wb-timeline">
            {/* Speed selector */}
            <div class="wb-timeline-speed-wrap">
                <button
                    class="wb-timeline-speed-btn"
                    onClick={() => setSpeedOpen(!speedOpen())}
                    title="Playback speed"
                >
                    {props.speedLabels[props.speedIndex()]}
                </button>
                {speedOpen() && (
                    <div class="wb-timeline-speed-dropdown">
                        <For each={[...props.speedLabels]}>
                            {(label, i) => (
                                <button
                                    class={`wb-timeline-speed-option${i() === props.speedIndex() ? ' selected' : ''}`}
                                    onClick={() => { props.onSpeedChange(i()); setSpeedOpen(false); }}
                                >
                                    {label}
                                </button>
                            )}
                        </For>
                    </div>
                )}
            </div>
            <button
                class="wb-timeline-play"
                onClick={props.onPlayPause}
                title={props.isPlaying() ? 'Pause' : 'Play'}
            >
                {props.isPlaying() ? '⏸' : '▶'}
            </button>
            <div class="wb-timeline-slider-wrap">
                <input
                    type="range"
                    min="-1"
                    max={Math.max(-1, props.totalEvents() - 1)}
                    value={props.currentEventIndex()}
                    onInput={handleSliderInput}
                    class="wb-timeline-slider"
                />
                <div class="wb-timeline-notches">
                    <For each={Array.from({ length: totalPositions() }, (_, i) => i)}>
                        {(i) => {
                            const eventIndex = i - 1;
                            return (
                                <div
                                    class={`wb-timeline-notch${eventIndex === props.currentEventIndex() ? ' active' : ''}${eventIndex === -1 ? ' blank' : ''}`}
                                    style={{ left: `${(i / Math.max(1, totalPositions() - 1)) * 100}%` }}
                                />
                            );
                        }}
                    </For>
                </div>
            </div>
            <button
                class="wb-timeline-step"
                onClick={() => props.onEventChange(Math.max(-1, props.currentEventIndex() - 1))}
                disabled={props.currentEventIndex() <= -1}
                title="Previous event"
            >
                ◀
            </button>
            <button
                class="wb-timeline-step"
                onClick={() => props.onEventChange(Math.min(props.totalEvents() - 1, props.currentEventIndex() + 1))}
                disabled={props.currentEventIndex() >= props.totalEvents() - 1}
                title="Next event"
            >
                ▶
            </button>
            <div class="wb-timeline-info">
                {props.currentEventIndex() === -1 ? '—' : props.currentEventIndex() + 1}/{props.totalEvents()}
            </div>
        </div>
    );
}
