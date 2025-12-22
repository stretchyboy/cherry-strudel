// MusicXML to Strudel converter - timing-based approach
// Uses OpenSheetMusicDisplay (OSMD) as source of truth for timing

let osmd = null;
let audioPlayer = null;
let playbackEvents = null; // Store timing events for playback

/**
 * Convert MusicXML to Strudel code using OSMD timing information
 * @param {string} xmlText - MusicXML text
 * @returns {Promise<string>} Strudel pattern code
 */
async function musicXmlToStrudel(xmlText) {
    try {
        if (!xmlText || !xmlText.trim()) {
            return '// Please provide MusicXML input';
        }

        // Create OSMD instance if needed
        const container = document.getElementById('sheet-music');
        if (!osmd) {
            osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
                autoResize: true,
                drawTitle: true,
                drawComposer: true
            });
        }

        // Load the MusicXML
        await osmd.load(xmlText);
        await osmd.render();

        console.log('OSMD loaded and rendered');
        console.log('Sheet:', osmd.sheet);

        // Get timing and musical information
        const sheet = osmd.sheet;
        const title = sheet.TitleString || 'Untitled';
        
        // Get first measure for tempo, time signature, and key
        const firstMeasure = sheet.SourceMeasures[0];
        
        // Get tempo (default 120 BPM)
        let tempo = 120;
        if (firstMeasure && firstMeasure.TempoInBPM) {
            tempo = firstMeasure.TempoInBPM;
        } else if (sheet.DefaultStartTempoInBpm) {
            tempo = sheet.DefaultStartTempoInBpm;
        }

        // Get time signature
        let meterNum = 4, meterDen = 4;
        if (firstMeasure && firstMeasure.ActiveTimeSignature) {
            meterNum = firstMeasure.ActiveTimeSignature.Numerator;
            meterDen = firstMeasure.ActiveTimeSignature.Denominator;
        }

        // Calculate CPM (cycles per minute) - one cycle = one bar
        const beatsPerBar = meterNum * (4 / meterDen);
        const cpm = Math.round(tempo / beatsPerBar);

        console.log(`Tempo: ${tempo} BPM, Meter: ${meterNum}/${meterDen}, beatsPerBar: ${beatsPerBar}, CPM: ${cpm}`);

        // Get key signature
        let keyRoot = 'C';
        let keyMode = 'major';
        if (firstMeasure && firstMeasure.ActiveKeyInstruction) {
            const key = firstMeasure.ActiveKeyInstruction.Key;
            // OSMD uses key signature number (-7 to +7)
            // Simplified: extract from AlterationSymbolForDisplayText or use default
            keyRoot = 'C'; // TODO: map key signature to root
            keyMode = key < 0 ? 'minor' : 'major';
        }
        const scaleName = `${keyRoot}:${keyMode}`;

        // Calculate timing parameters
        const msPerBeat = 60000 / tempo;
        const msPerBar = beatsPerBar * msPerBeat;

        console.log(`msPerBeat: ${msPerBeat}, msPerBar: ${msPerBar}`);

        // Extract timing events for each instrument/part
        const parts = sheet.Instruments;
        const allPartBars = [];
        const allTimingEvents = []; // Store all events for playback

        for (let partIdx = 0; partIdx < parts.length; partIdx++) {
            const part = parts[partIdx];
            const partName = part.NameLabel?.text || `Part ${partIdx + 1}`;
            console.log(`\nProcessing part ${partIdx}: ${partName}`);

            const timingEvents = [];
            let voiceEntryCounter = 0; // Unique ID for each voiceEntry (chord group)

            // Walk through all source measures and filter by this instrument
            let measureStartTime = 0; // Accumulate absolute time across measures
            for (let measureIdx = 0; measureIdx < sheet.SourceMeasures.length; measureIdx++) {
                const sourceMeasure = sheet.SourceMeasures[measureIdx];
                
                // Each measure has VerticalSourceStaffEntryContainers
                const containers = sourceMeasure.VerticalSourceStaffEntryContainers;
                if (!containers) {
                    measureStartTime += msPerBar;
                    continue;
                }
                
                for (const container of containers) {
                    // Each container has StaffEntries for different staves/parts
                    const staffEntries = container.StaffEntries;
                    if (!staffEntries || staffEntries.length === 0) continue;
                    
                    for (const staffEntry of staffEntries) {
                        if (!staffEntry) continue;
                        
                        // Check if this staff entry belongs to this instrument
                        if (staffEntry.ParentStaff?.ParentInstrument !== part) {
                            continue;
                        }

                        // Get the time relative to measure start, then add measure offset
                        const timestamp = staffEntry.Timestamp;
                        if (!timestamp) continue;
                        const timeMsInMeasure = timestamp.RealValue * msPerBeat * 4;
                        const timeMs = measureStartTime + timeMsInMeasure;

                        // Process each voice entry in the staff entry
                        const voiceEntries = staffEntry.VoiceEntries;
                        if (!voiceEntries) continue;
                        
                        for (const voiceEntry of voiceEntries) {
                            if (!voiceEntry || !voiceEntry.Notes) continue;
                            
                            // Increment counter for this voiceEntry - all notes here form a chord
                            voiceEntryCounter++;
                            const currentVoiceEntryId = voiceEntryCounter;
                            
                            // Process each note in the voice entry
                            for (const note of voiceEntry.Notes) {
                                const durationMs = note.Length.RealValue * msPerBeat * 4;

                                if (note.isRest()) {
                                    timingEvents.push({
                                        timeMs: timeMs,
                                        pitch: null,
                                        durationMs: durationMs,
                                        isRest: true,
                                        voiceEntryId: currentVoiceEntryId // Track which notes are in same chord
                                    });
                                } else {
                                    // Get MIDI pitch
                                    const midiPitch = note.Pitch.getHalfTone() + 12;
                                    
                                    timingEvents.push({
                                        timeMs: timeMs,
                                        midiPitch: midiPitch,
                                        durationMs: durationMs,
                                        isRest: false,
                                        voiceEntryId: currentVoiceEntryId // Track which notes are in same chord
                                    });
                                }
                            }
                        }
                    }
                }
                
                // Move to next measure
                measureStartTime += msPerBar;
            }

            console.log(`Part ${partIdx}: ${timingEvents.length} timing events`);

            // Debug: show first few events
            console.log(`First 10 timing events for part ${partIdx}:`);
            for (let i = 0; i < Math.min(10, timingEvents.length); i++) {
                const evt = timingEvents[i];
                console.log(`  ${i}: time=${evt.timeMs.toFixed(1)}ms, dur=${evt.durationMs.toFixed(1)}ms, pitch=${evt.midiPitch}, rest=${evt.isRest}, voiceId=${evt.voiceEntryId}`);
            }

            // Deduplicate timing events (remove exact duplicates)
            const uniqueEvents = [];
            const seen = new Set();
            for (const event of timingEvents) {
                const key = `${event.timeMs}_${event.durationMs}_${event.midiPitch}_${event.isRest}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueEvents.push(event);
                }
            }
            console.log(`After deduplication: ${uniqueEvents.length} unique events`);

            // Sort events by time before grouping into bars
            uniqueEvents.sort((a, b) => a.timeMs - b.timeMs);

            // Group timing events into bars
            const bars = [];
            let currentBar = { notes: [], startTime: 0 };
            let barNumber = 0;
            let expectedTime = 0;

            for (const event of uniqueEvents) {
                const noteStartTime = event.timeMs;
                const noteEndTime = event.timeMs + event.durationMs;

                // Don't fill gaps - only use explicit rests from the score
                // If there are gaps, Strudel will handle them naturally

                // Check if note starts in a future bar
                while (noteStartTime >= (barNumber + 1) * msPerBar) {
                    bars.push(currentBar);
                    barNumber++;
                    currentBar = { notes: [], startTime: barNumber * msPerBar };
                }

                const currentBarEnd = (barNumber + 1) * msPerBar;

                // Check if note extends past current bar boundary
                if (noteEndTime > currentBarEnd + 1) {
                    const durationInFirstBar = currentBarEnd - noteStartTime;

                    currentBar.notes.push({
                        timeOffset: noteStartTime - (barNumber * msPerBar),
                        midiPitch: event.midiPitch,
                        durationMs: durationInFirstBar,
                        isRest: event.isRest
                    });

                    bars.push(currentBar);
                    barNumber++;

                    const remainingDuration = event.durationMs - durationInFirstBar;
                    currentBar = {
                        notes: [{
                            timeOffset: 0,
                            midiPitch: event.midiPitch,
                            durationMs: remainingDuration,
                            isRest: event.isRest
                        }],
                        startTime: barNumber * msPerBar
                    };
                } else {
                    currentBar.notes.push({
                        timeOffset: noteStartTime - (barNumber * msPerBar),
                        midiPitch: event.midiPitch,
                        durationMs: event.durationMs,
                        isRest: event.isRest,
                        voiceEntryId: event.voiceEntryId
                    });
                }

                expectedTime = noteEndTime;
            }

            if (currentBar.notes.length > 0) {
                bars.push(currentBar);
            }

            // Debug: check bar durations
            console.log(`Part ${partIdx} bar durations (should be ${msPerBar}ms each):`);
            for (let i = 0; i < Math.min(5, bars.length); i++) {
                const totalDur = bars[i].notes.reduce((sum, n) => sum + n.durationMs, 0);
                console.log(`  Bar ${i}: ${totalDur}ms`);
            }

            // Handle pickup measure (anacrusis) - pad first bar if incomplete
            if (bars.length > 0) {
                const firstBar = bars[0];
                const firstBarDuration = firstBar.notes.reduce((sum, n) => sum + n.durationMs, 0);
                if (firstBarDuration < msPerBar - 1) {
                    // This is a pickup measure - add rest at the beginning
                    const restDuration = msPerBar - firstBarDuration;
                    firstBar.notes.unshift({
                        timeOffset: 0,
                        pitch: null,
                        durationMs: restDuration,
                        isRest: true
                    });
                    // Adjust timeOffset of all other notes
                    for (let i = 1; i < firstBar.notes.length; i++) {
                        firstBar.notes[i].timeOffset += restDuration;
                    }
                }
            }

            console.log(`Part ${partIdx}: Grouped into ${bars.length} bars`);
            allPartBars.push(bars);
            allTimingEvents.push(uniqueEvents); // Save for playback
        }

        // Store events for playback
        playbackEvents = allTimingEvents;

        // Generate Strudel code
        // Format title with // on each line
        const titleLines = title.split('\n').map(line => `// ${line}`).join('\n');
        let code = `${titleLines}\n`;
        code += `setcpm(${cpm})\n\n`;

        const tonicMidi = 60; // C4 as reference
        const partPatterns = [];

        for (let partIdx = 0; partIdx < allPartBars.length; partIdx++) {
            const bars = allPartBars[partIdx];
            const strudelBars = [];

            for (const bar of bars) {
                const noteStrings = [];

                // Group notes by voiceEntryId to detect true chords (notes that were together in the source)
                const noteGroups = new Map();
                for (const note of bar.notes) {
                    const groupKey = note.voiceEntryId || `${Math.round(note.timeOffset)}_${Math.round(note.durationMs)}`;
                    
                    if (!noteGroups.has(groupKey)) {
                        noteGroups.set(groupKey, { timeOffset: note.timeOffset, duration: note.durationMs, notes: [] });
                    }
                    noteGroups.get(groupKey).notes.push(note);
                }

                const sortedGroups = Array.from(noteGroups.values()).sort((a, b) => a.timeOffset - b.timeOffset);

                for (const group of sortedGroups) {
                    const notesInGroup = group.notes;
                    const allRests = notesInGroup.every(n => n.isRest);

                    if (allRests) {
                        // Convert duration to units where a full bar = meterNum (so 3/8 bar = 3 units)
                        const durationUnits = notesInGroup[0].durationMs / msPerBar * meterNum;
                        noteStrings.push(`~@${durationUnits.toFixed(3).replace(/\.?0+$/, '')}`);
                        continue;
                    }

                    const scaleDegrees = [];
                    let duration = 0;

                    for (const note of notesInGroup) {
                        if (note.isRest) continue;
                        
                        // Convert MIDI to scale degree relative to C (simplified)
                        const scaleDegree = note.midiPitch - tonicMidi;
                        scaleDegrees.push(scaleDegree);

                        if (duration === 0) {
                            // Convert duration to units where a full bar = meterNum
                            duration = note.durationMs / msPerBar * meterNum;
                        }
                    }

                    if (scaleDegrees.length === 0) continue;

                    // Format duration, remove trailing zeros
                    const durationStr = duration.toFixed(3).replace(/\.?0+$/, '');

                    // Chord if multiple notes
                    if (scaleDegrees.length > 1) {
                        noteStrings.push(`[${scaleDegrees.join(',')}]@${durationStr}`);
                    } else {
                        noteStrings.push(`${scaleDegrees[0]}@${durationStr}`);
                    }
                }

                strudelBars.push(`n("${noteStrings.join(' ')}")`);
            }

            // Format bars
            code += `const part${partIdx} = [`;
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
            partPatterns.push(`cat(...part${partIdx})`);
        }

        // Combine parts
        if (partPatterns.length > 1) {
            code += `stack(${partPatterns.join(', ')})\n  .scale("${scaleName}").s("gm_piano");`;
        } else {
            code += `${partPatterns[0]}.scale("${scaleName}").s("gm_piano");`;
        }

        return code;

    } catch (err) {
        console.error('Error in musicXmlToStrudel:', err);
        return `// Error: ${err.message || String(err)}`;
    }
}

// Wire up the UI
document.addEventListener('DOMContentLoaded', function() {
    const fileUpload = document.getElementById('file-upload');
    const xmlInput = document.getElementById('xml-input');
    const convertBtn = document.getElementById('convert');
    const playBtn = document.getElementById('play-xml');
    const stopBtn = document.getElementById('stop-xml');

    // Handle file upload
    fileUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                xmlInput.value = event.target.result;
            };
            reader.readAsText(file);
        }
    });

    // Handle convert button
    convertBtn.addEventListener('click', async function() {
        const xmlText = xmlInput.value;
        
        try {
            const strudelCode = await musicXmlToStrudel(xmlText);

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
    });

    // Handle play button
    playBtn.addEventListener('click', async function() {
        if (!playbackEvents || playbackEvents.length === 0) {
            alert('Please convert the MusicXML first');
            return;
        }
        
        try {
            // Initialize Tone.js
            await Tone.start();
            
            // Create a simple synth
            const synth = new Tone.PolySynth(Tone.Synth, {
                envelope: {
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 1
                }
            }).toDestination();
            
            // Schedule all notes from all parts
            const now = Tone.now();
            for (const partEvents of playbackEvents) {
                for (const event of partEvents) {
                    if (event.isRest) continue;
                    
                    const timeInSeconds = event.timeMs / 1000;
                    const durationInSeconds = event.durationMs / 1000;
                    const freq = Tone.Frequency(event.midiPitch, "midi").toFrequency();
                    
                    synth.triggerAttackRelease(freq, durationInSeconds, now + timeInSeconds, 0.5);
                }
            }
            
            console.log('Playback started');
        } catch (err) {
            console.error('Playback error:', err);
            alert(`Playback error: ${err.message}`);
        }
    });

    // Handle stop button
    stopBtn.addEventListener('click', function() {
        if (audioPlayer) {
            audioPlayer.releaseAll();
        }
    });
});
