// MIDI to Strudel converter - timing-based approach
// Uses MIDI file timing as source of truth

let midiData = null;
let playbackSynth = null;

/**
 * Convert MIDI to Strudel code using timing information
 * @param {ArrayBuffer} arrayBuffer - MIDI file data
 * @returns {string} Strudel pattern code
 */
async function midiToStrudel(arrayBuffer) {
    try {
        // Parse MIDI file
        const midi = new Midi(arrayBuffer);
        midiData = midi;

        console.log('MIDI loaded:', midi);
        console.log('Tracks:', midi.tracks.length);
        console.log('Tempo:', midi.header.tempos);
        console.log('Time signature:', midi.header.timeSignatures);

        // Get tempo (use first tempo marking or default 120)
        const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
        
        // Get time signature (use first or default 4/4)
        let meterNum = 4, meterDen = 4;
        if (midi.header.timeSignatures.length > 0) {
            meterNum = midi.header.timeSignatures[0].timeSignature[0];
            meterDen = midi.header.timeSignatures[0].timeSignature[1];
        }

        // Calculate CPM (cycles per minute) - one cycle = one bar
        const beatsPerBar = meterNum * (4 / meterDen);
        const cpm = Math.round(tempo / beatsPerBar);

        console.log(`Tempo: ${tempo} BPM, Meter: ${meterNum}/${meterDen}, CPM: ${cpm}`);

        // Get key signature from MIDI if available
        let keyRoot = 'C';
        let keyMode = 'major';
        if (midi.header.keySignatures && midi.header.keySignatures.length > 0) {
            const keySig = midi.header.keySignatures[0];
            console.log('Key signature:', keySig);
            // MIDI key signature: positive = sharps, negative = flats
            // 0=C, 1=G, 2=D, -1=F, -2=Bb, etc.
            const keyMap = {
                '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
                '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#'
            };
            keyRoot = keyMap[keySig.key.toString()] || 'C';
            keyMode = keySig.scale === 1 ? 'minor' : 'major';
        }
        const scaleName = `${keyRoot}:${keyMode}`;
        console.log(`Key: ${scaleName}`);

        // Calculate timing parameters
        const msPerBeat = 60000 / tempo;
        const msPerBar = beatsPerBar * msPerBeat;

        console.log(`msPerBeat: ${msPerBeat}, msPerBar: ${msPerBar}`);

        // Helper function to convert MIDI pitch to diatonic scale degree
        // MIDI is chromatic (semitones), Strudel scale degrees are diatonic (notes in scale)
        function midiToScaleDegree(midiPitch, keyRoot = 'C') {
            // Map key roots to their MIDI pitch at octave 4
            const rootPitches = {
                'C': 60, 'Db': 61, 'D': 62, 'Eb': 63, 'E': 64, 'F': 65,
                'Gb': 66, 'F#': 66, 'G': 67, 'Ab': 68, 'A': 69, 'Bb': 70, 'B': 71,
                'Cb': 59, 'C#': 61
            };
            const rootMidi = rootPitches[keyRoot] || 60;
            
            // Get chromatic distance from root
            const chromaticDistance = midiPitch - rootMidi;
            
            // Convert chromatic to diatonic
            // Major scale pattern: W W H W W W H (2 2 1 2 2 2 1 semitones)
            // 0=root, 2=2nd, 4=3rd, 5=4th, 7=5th, 9=6th, 11=7th, 12=octave
            const chromaticToDiatonic = {
                0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6
            };
            
            const octave = Math.floor(chromaticDistance / 12);
            const chromaticInOctave = ((chromaticDistance % 12) + 12) % 12;
            const diatonicInOctave = chromaticToDiatonic[chromaticInOctave];
            
            return octave * 7 + diatonicInOctave;
        }

        // Helper function to quantize duration to common note values
        function quantizeDuration(duration) {
            // Common note divisions (in units where 1 bar = meterNum)
            const divisions = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.1875, 0.125];
            
            // Find closest division
            let closest = divisions[0];
            let minDiff = Math.abs(duration - closest);
            
            for (const div of divisions) {
                const diff = Math.abs(duration - div);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = div;
                }
            }
            
            return closest;
        }

        // Extract timing events for each track
        const allTrackBars = [];
        const trackNames = [];
        const trackBarLengths = []; // Store target bar length for each track

        for (let trackIdx = 0; trackIdx < midi.tracks.length; trackIdx++) {
            const track = midi.tracks[trackIdx];
            
            // Skip empty tracks
            if (track.notes.length === 0) {
                console.log(`Skipping empty track ${trackIdx}`);
                continue;
            }
            
            const trackName = track.name || `Track ${trackIdx + 1}`;
            console.log(`\nProcessing track ${trackIdx}: ${trackName}, ${track.notes.length} notes, channel: ${track.channel}`);

            // Extract timing events
            const timingEvents = [];
            for (const note of track.notes) {
                const timeMs = note.time * 1000;
                const durationMs = note.duration * 1000;
                const midiPitch = note.midi;
                const velocity = note.velocity || 64;

                // Filter out extremely short notes (< 10ms) or completely silent notes (velocity = 0)
                if (durationMs < 10 || velocity === 0) {
                    console.log(`Skipping inaudible note: duration=${durationMs.toFixed(1)}ms, velocity=${velocity}`);
                    continue;
                }

                timingEvents.push({
                    timeMs: timeMs,
                    midiPitch: midiPitch,
                    durationMs: durationMs,
                    velocity: velocity,
                    isRest: false
                });
            }

            // Sort by time
            timingEvents.sort((a, b) => a.timeMs - b.timeMs);

            console.log(`Track ${trackIdx}: ${timingEvents.length} timing events`);

            // Split by pitch range - separate into high (right hand) and low (left hand)
            const splitPitch = 60; // Middle C
            const highEvents = timingEvents.filter(e => e.midiPitch >= splitPitch);
            const lowEvents = timingEvents.filter(e => e.midiPitch < splitPitch);

            console.log(`  High notes (>= C4): ${highEvents.length}`);
            console.log(`  Low notes (< C4): ${lowEvents.length}`);

            // Process each hand separately if both exist
            const handsToProcess = [];
            if (highEvents.length > 0) {
                handsToProcess.push({ events: highEvents, name: `${trackName} (High)` });
            }
            if (lowEvents.length > 0) {
                handsToProcess.push({ events: lowEvents, name: `${trackName} (Low)` });
            }

            // Collect all fractional durations to find optimal multiplier
            const allFractionalDurations = new Set();
            for (const hand of handsToProcess) {
                for (const event of hand.events) {
                    const durationInBeats = event.durationMs / msPerBar * meterNum;
                    allFractionalDurations.add(durationInBeats);
                }
            }

            // Find smallest multiplier that makes all durations integers
            let multiplier = 1;
            for (let m = 1; m <= 64; m++) {
                let allIntegers = true;
                for (const dur of allFractionalDurations) {
                    if (Math.abs(Math.round(dur * m) - (dur * m)) > 0.01) {
                        allIntegers = false;
                        break;
                    }
                }
                if (allIntegers) {
                    multiplier = m;
                    break;
                }
            }

            console.log(`Using multiplier: ${multiplier * 4} (base: ${multiplier}, quadrupled for resolution)`);
            const targetBarLength = meterNum * multiplier * 4;
            console.log(`Target bar length: ${targetBarLength} units`);

            for (const hand of handsToProcess) {
                trackNames.push(hand.name);
                console.log(`\nProcessing ${hand.name}: ${hand.events.length} notes`);

                // First pass: convert all notes to quantized units using quadrupled multiplier
                const quantizedNotes = [];
                for (const event of hand.events) {
                    const timeInUnits = event.timeMs / msPerBar * meterNum * multiplier * 4;
                    const durationInUnits = event.durationMs / msPerBar * meterNum * multiplier * 4;
                    
                    quantizedNotes.push({
                        time: Math.round(timeInUnits),
                        duration: Math.round(durationInUnits),
                        midiPitch: event.midiPitch,
                        originalTimeMs: event.timeMs // Keep original time for chord detection
                    });
                }

                // Second pass: group quantized notes into bars
                const bars = [];
                let currentBar = { notes: [] };
                let barNumber = 0;

                for (const note of quantizedNotes) {
                    // Check if note starts in a future bar
                    while (note.time >= (barNumber + 1) * targetBarLength) {
                        bars.push(currentBar);
                        barNumber++;
                        currentBar = { notes: [] };
                    }

                    const noteEndTime = note.time + note.duration;
                    const currentBarEnd = (barNumber + 1) * targetBarLength;

                    // Check if note extends past current bar boundary
                    if (noteEndTime > currentBarEnd) {
                        const durationInFirstBar = currentBarEnd - note.time;

                        if (durationInFirstBar > 0) {
                            currentBar.notes.push({
                                time: note.time - (barNumber * targetBarLength),
                                duration: durationInFirstBar,
                                midiPitch: note.midiPitch,
                                originalTimeMs: note.originalTimeMs
                            });
                        }

                        bars.push(currentBar);
                        barNumber++;

                        const remainingDuration = noteEndTime - currentBarEnd;
                        if (remainingDuration > 0) {
                            currentBar = {
                                notes: [{
                                    time: 0,
                                    duration: remainingDuration,
                                    midiPitch: note.midiPitch,
                                    originalTimeMs: note.originalTimeMs
                                }]
                            };
                        } else {
                            currentBar = { notes: [] };
                        }
                    } else {
                        currentBar.notes.push({
                            time: note.time - (barNumber * targetBarLength),
                            duration: note.duration,
                            midiPitch: note.midiPitch,
                            originalTimeMs: note.originalTimeMs
                        });
                    }
                }

                if (currentBar.notes.length > 0) {
                    bars.push(currentBar);
                }

                console.log(`${hand.name}: Grouped into ${bars.length} bars`);
                allTrackBars.push(bars);
                trackBarLengths.push(targetBarLength);
            }
        }

        // Generate Strudel code
        const title = midi.header.name || 'MIDI File';
        let code = `// ${title}\n`;
        code += `setcpm(${cpm})\n\n`;

        const tonicMidi = 60; // C4 as reference
        const trackPatterns = [];

        for (let trackIdx = 0; trackIdx < allTrackBars.length; trackIdx++) {
            const bars = allTrackBars[trackIdx];
            const targetBarLength = trackBarLengths[trackIdx];
            const strudelBars = [];

            for (const bar of bars) {
                const noteStrings = [];
                let currentPosition = 0; // Track position in bar

                // Sort notes by original time first, then by quantized time
                const sortedNotes = bar.notes.sort((a, b) => {
                    const timeDiff = (a.originalTimeMs || 0) - (b.originalTimeMs || 0);
                    if (Math.abs(timeDiff) < 2) {
                        // Truly simultaneous - maintain quantized time order
                        return a.time - b.time;
                    }
                    return timeDiff;
                });

                let i = 0;
                while (i < sortedNotes.length) {
                    const note = sortedNotes[i];
                    const noteStartPosition = note.time;
                    
                    // Fill gap with rest if needed (only if gap is significant, > 1 unit)
                    if (noteStartPosition > currentPosition + 1) {
                        const restDuration = noteStartPosition - currentPosition;
                        noteStrings.push(`~@${restDuration}`);
                        currentPosition += restDuration;
                    } else if (noteStartPosition > currentPosition) {
                        // Small gap - just move forward
                        currentPosition = noteStartPosition;
                    }

                    // Process each note individually (chord detection disabled)
                    const scaleDegree = midiToScaleDegree(note.midiPitch, keyRoot);
                    let duration = note.duration;

                    // Extend duration to next note if there's a gap (< 4 units)
                    if (i + 1 < sortedNotes.length) {
                        const nextNoteTime = sortedNotes[i + 1].time;
                        const gapToNext = nextNoteTime - (noteStartPosition + duration);
                        if (gapToNext > 0 && gapToNext < 4) {
                            duration += gapToNext;
                        }
                    }

                    if (duration > 0) {
                        // Check if note would overflow bar - trim if needed
                        const remainingSpace = targetBarLength - currentPosition;
                        const actualDuration = Math.min(duration, remainingSpace);
                        
                        if (actualDuration > 0) {
                            noteStrings.push(`${scaleDegree}@${actualDuration}`);
                            currentPosition += actualDuration;
                        }
                    }

                    i++;
                }

                // Fill end of bar with rest if needed
                if (currentPosition < targetBarLength) {
                    const restDuration = targetBarLength - currentPosition;
                    noteStrings.push(`~@${restDuration}`);
                }

                // Verify bar length
                const barTotal = noteStrings.reduce((sum, str) => {
                    const match = str.match(/@(\d+)/);
                    return sum + (match ? parseInt(match[1]) : 1);
                }, 0);
                
                if (barTotal !== targetBarLength) {
                    console.warn(`Bar ${strudelBars.length} length mismatch: ${barTotal} (expected ${targetBarLength})`);
                    console.warn(`  Contents: ${noteStrings.join(' ')}`);
                    console.warn(`  currentPosition was: ${currentPosition}`);
                }

                // Only add bar if it has content
                if (noteStrings.length > 0) {
                    strudelBars.push(`n("${noteStrings.join(' ')}")`);
                } else {
                    // Empty bar - fill with rest
                    strudelBars.push(`n("~@${targetBarLength}")`);
                }
            }

            // Format bars
            code += `const part${trackIdx} = [`;
            let currentLine = '';
            for (let i = 0; i < strudelBars.length; i++) {
                const bar = strudelBars[i];
                const sep = (i < strudelBars.length - 1) ? ', ' : '';
                const testLine = currentLine ? currentLine + bar + sep : bar + sep;

                if (testLine.length <= 80) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        code += currentLine + '\n  ';
                        currentLine = bar + sep;
                    } else {
                        currentLine = bar + sep;
                    }
                }
            }
            if (currentLine) {
                code += currentLine;
            }

            code += `];\n\n`;
            trackPatterns.push(`cat(...part${trackIdx})`);
        }

        // Combine tracks
        if (trackPatterns.length > 1) {
            code += `stack(${trackPatterns.join(', ')})\n  .scale("${scaleName}").s("gm_piano");`;
        } else {
            code += `${trackPatterns[0]}.scale("${scaleName}").s("gm_piano");`;
        }

        return code;

    } catch (err) {
        console.error('Error in midiToStrudel:', err);
        return `// Error: ${err.message || String(err)}`;
    }
}

// Wire up the UI
document.addEventListener('DOMContentLoaded', function() {
    const fileUpload = document.getElementById('file-upload');
    const urlInput = document.getElementById('url-input');
    const loadUrlBtn = document.getElementById('load-url');
    const convertBtn = document.getElementById('convert');
    const playBtn = document.getElementById('play-midi');
    const stopBtn = document.getElementById('stop-midi');

    // Process MIDI file
    async function processMidiFile(arrayBuffer) {
        try {
            const strudelCode = await midiToStrudel(arrayBuffer);

            // Update Strudel editor
            const editor = document.querySelector('strudel-editor');
            if (editor) {
                editor.setAttribute('code', strudelCode);
                if (editor.requestUpdate) {
                    editor.requestUpdate();
                }
            }
        } catch (err) {
            console.error('Conversion error:', err);
            alert(`Error: ${err.message}`);
        }
    }

    // Handle file upload
    fileUpload.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            await processMidiFile(arrayBuffer);
        }
    });

    // Handle URL loading
    loadUrlBtn.addEventListener('click', async function() {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a URL');
            return;
        }
        
        try {
            // Try direct fetch first
            let response;
            try {
                response = await fetch(url);
                if (!response.ok) throw new Error('Failed to load URL');
            } catch (err) {
                // If CORS error, try with proxy
                console.log('Direct fetch failed, trying CORS proxy...', err);
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Failed to load URL through proxy');
            }
            
            const arrayBuffer = await response.arrayBuffer();
            await processMidiFile(arrayBuffer);
            urlInput.value = '';
        } catch (err) {
            console.error('Error loading URL:', err);
            alert('Failed to load URL. The server may not allow cross-origin requests. Try downloading the file and using the file upload option instead.');
        }
    });

    // Handle convert button (re-convert)
    convertBtn.addEventListener('click', async function() {
        if (!midiData) {
            alert('Please upload a MIDI file first');
            return;
        }
        
        // Re-trigger conversion (in case user wants to refresh)
        const strudelCode = await midiToStrudel(midiData.toArray());
        const editor = document.querySelector('strudel-editor');
        if (editor) {
            editor.setAttribute('code', strudelCode);
            if (editor.requestUpdate) {
                editor.requestUpdate();
            }
        }
    });

    // Handle play button - play original MIDI
    playBtn.addEventListener('click', async function() {
        if (!midiData) {
            alert('Please upload a MIDI file first');
            return;
        }
        
        try {
            await Tone.start();
            
            if (!playbackSynth) {
                playbackSynth = new Tone.PolySynth(Tone.Synth).toDestination();
            }
            
            // Schedule all notes
            const now = Tone.now();
            for (const track of midiData.tracks) {
                for (const note of track.notes) {
                    playbackSynth.triggerAttackRelease(
                        note.name,
                        note.duration,
                        now + note.time,
                        note.velocity
                    );
                }
            }
            
            console.log('MIDI playback started');
        } catch (err) {
            console.error('Playback error:', err);
            alert(`Playback error: ${err.message}`);
        }
    });

    // Handle stop button
    stopBtn.addEventListener('click', function() {
        if (playbackSynth) {
            playbackSynth.releaseAll();
        }
    });
});
